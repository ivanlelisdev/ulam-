import { useEffect, useState } from "react";
import type { CookingSession } from "../data/schema";
import {
  type UlamDatabase,
  updateCooking,
  finishCooking,
} from "../data/database";
import { remainingSeconds, ingredientName, scaledAmount } from "../product";
import { Icon } from "./Icon";
export function CookingScreen({
  db,
  session,
  onUpdate,
  onExit,
  onFinished,
}: {
  db: UlamDatabase;
  session: CookingSession;
  onUpdate: (value: CookingSession) => void;
  onExit: () => void;
  onFinished: () => void;
}) {
  const [now, setNow] = useState(Date.now());
  const [minutes, setMinutes] = useState("2");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const index = session.snapshot.recipe.steps.findIndex(
    (step) => step.id === session.stepId,
  );
  const step = session.snapshot.recipe.steps[index];
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    const refresh = () => setNow(Date.now());
    document.addEventListener("visibilitychange", refresh);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, []);
  useEffect(
    () => setMinutes(String(step.timerSeconds ? step.timerSeconds / 60 : 2)),
    [step.id, step.timerSeconds],
  );
  const remaining = session.timer
    ? remainingSeconds(session.timer.deadline, now)
    : null;
  async function change(patch: unknown) {
    setBusy(true);
    setError("");
    try {
      onUpdate(await updateCooking(db, session.sessionId, patch));
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Could not save cooking progress. Retry before leaving.",
      );
    } finally {
      setBusy(false);
    }
  }
  function timer(seconds: number) {
    if (!Number.isSafeInteger(seconds) || seconds <= 0) {
      setError("Use a positive timer duration, for example 1 minute.");
      return;
    }
    const deadline = new Date(Date.now() + seconds * 1000);
    if (
      !Number.isFinite(deadline.valueOf()) ||
      deadline.getUTCFullYear() > 9999
    ) {
      setError("That timer is too long. Choose a shorter duration.");
      return;
    }
    void change({
      timer: { stepId: step.id, deadline: deadline.toISOString() },
    });
  }
  const lines = step.ingredientLineIds.length
    ? session.snapshot.recipe.ingredients.filter((line) =>
        step.ingredientLineIds.includes(line.id),
      )
    : session.snapshot.recipe.ingredients;
  return (
    <section className="cooking-screen">
      <div className="page-heading">
        <button className="quiet" onClick={onExit}>
          <Icon name="back" />
          Exit cooking
        </button>
        <h1 tabIndex={-1}>{session.snapshot.recipe.title}</h1>
      </div>
      <progress
        aria-label="Cooking progress"
        value={index + 1}
        max={session.snapshot.recipe.steps.length}
      />
      <div className="section-heading">
        <p>
          Step {index + 1} of {session.snapshot.recipe.steps.length}
        </p>
        <span>{session.servings} servings</span>
      </div>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <div className="cooking-step">
        <h2>{step.text}</h2>
        <ul className="step-amounts">
          {lines.map((line) => (
            <li key={line.id}>
              <strong>
                {scaledAmount(
                  line.amount,
                  session.servings,
                  session.snapshot.recipe.yieldServings,
                )}{" "}
                {line.unit}
              </strong>{" "}
              {ingredientName(session.snapshot, line)}
            </li>
          ))}
        </ul>
      </div>
      <div className="timer-panel">
        {session.timer && (
          <div className="timer-running">
            <p>
              Timer for step{" "}
              {session.snapshot.recipe.steps.findIndex(
                (item) => item.id === session.timer!.stepId,
              ) + 1}
            </p>
            <strong aria-live="off">
              {Math.floor((remaining || 0) / 60)}:
              {String((remaining || 0) % 60).padStart(2, "0")}
            </strong>
            {remaining === 0 && (
              <p role="alert">Timer finished. Check your food.</p>
            )}
            <button
              className="quiet"
              disabled={busy}
              onClick={() => change({ timer: null })}
            >
              Dismiss timer
            </button>
          </div>
        )}
        {step.timerSeconds && (
          <button disabled={busy} onClick={() => timer(step.timerSeconds!)}>
            <Icon name="clock" />
            Start {step.timerSeconds / 60} min timer
          </button>
        )}
        <details>
          <summary>Set a custom timer</summary>
          <form
            className="timer-form"
            onSubmit={(event) => {
              event.preventDefault();
              timer(Number(minutes) * 60);
            }}
          >
            <label>
              Custom timer minutes
              <input
                inputMode="decimal"
                value={minutes}
                onChange={(event) => setMinutes(event.target.value)}
              />
            </label>
            <button className="quiet" disabled={busy}>
              Start custom timer
            </button>
          </form>
        </details>
      </div>
      <details className="panel">
        <summary>All ingredients</summary>
        <ul>
          {session.snapshot.recipe.ingredients.map((line) => (
            <li key={line.id}>
              {scaledAmount(
                line.amount,
                session.servings,
                session.snapshot.recipe.yieldServings,
              )}{" "}
              {line.unit} {ingredientName(session.snapshot, line)}
            </li>
          ))}
        </ul>
      </details>
      <div className="cook-navigation">
        <button
          className="quiet"
          disabled={busy || index === 0}
          onClick={() =>
            change({ stepId: session.snapshot.recipe.steps[index - 1].id })
          }
        >
          <Icon name="back" />
          Previous
        </button>
        {index < session.snapshot.recipe.steps.length - 1 ? (
          <button
            disabled={busy}
            onClick={() =>
              change({ stepId: session.snapshot.recipe.steps[index + 1].id })
            }
          >
            Next
            <Icon name="next" />
          </button>
        ) : (
          <button
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await finishCooking(db, session.sessionId);
                onFinished();
              } catch (cause) {
                setError((cause as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            Finish cooking
            <Icon name="check" />
          </button>
        )}
      </div>
    </section>
  );
}
