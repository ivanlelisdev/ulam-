import { addDays, weekStart } from "../domain";
import { Icon } from "./Icon";
export function WeekPicker({
  date,
  onChange,
}: {
  date: string;
  onChange: (value: string) => void;
}) {
  const week = weekStart(date);
  return (
    <div className="week-picker">
      <div className="section-heading">
        <button
          className="icon-button quiet"
          aria-label="Previous week"
          onClick={() => onChange(addDays(date, -7))}
        >
          <Icon name="back" />
        </button>
        <h2>
          Week of{" "}
          {new Date(`${week}T12:00:00`).toLocaleDateString(undefined, {
            month: "short",
            day: "numeric",
            year: "numeric",
          })}
        </h2>
        <button
          className="icon-button quiet"
          aria-label="Next week"
          onClick={() => onChange(addDays(date, 7))}
        >
          <Icon name="next" />
        </button>
      </div>
      <div className="day-picker" aria-label="Choose day">
        {Array.from({ length: 7 }, (_, index) => addDays(week, index)).map(
          (day) => (
            <button
              key={day}
              aria-pressed={day === date}
              onClick={() => onChange(day)}
            >
              <span>
                {new Date(`${day}T12:00:00`).toLocaleDateString(undefined, {
                  weekday: "short",
                })}
              </span>
              <strong>{Number(day.slice(-2))}</strong>
            </button>
          ),
        )}
      </div>
    </div>
  );
}
