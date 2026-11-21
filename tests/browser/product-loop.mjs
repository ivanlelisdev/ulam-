import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { join, dirname, basename, resolve } from "node:path";
import { tmpdir } from "node:os";
import { setTimeout as delay } from "node:timers/promises";
import { chromium, devices } from "playwright-core";
import AxeBuilder from "@axe-core/playwright";
const executablePath =
  process.env.CHROME_PATH ||
  [
    "C:/Program Files/Google/Chrome/Application/chrome.exe",
    "/usr/bin/chromium",
    "/usr/bin/google-chrome",
  ].find(existsSync);
assert(executablePath, "Set CHROME_PATH to a Chromium executable.");
const origin = "http://127.0.0.1:4177",
  profile = mkdtempSync(join(tmpdir(), "ulam-phase4-"));
const server = spawn(
  process.execPath,
  [
    "node_modules/vite/bin/vite.js",
    "preview",
    "--host",
    "127.0.0.1",
    "--port",
    "4177",
    "--strictPort",
  ],
  { stdio: "pipe" },
);
let output = "";
server.stdout.on("data", (data) => (output += data));
server.stderr.on("data", (data) => (output += data));
let context, page;
const errors = [];
mkdirSync("docs/evidence", { recursive: true });
async function nav(name) {
  await page.getByRole("link", { name, exact: true }).click();
}
async function audit(screen) {
  const result = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
    .analyze();
  assert.deepEqual(
    result.violations.map((issue) => ({
      id: issue.id,
      nodes: issue.nodes.map((node) => node.target),
    })),
    [],
    screen + " accessibility",
  );
  await page.addStyleTag({ content: "html{font-size:200%}" });
  assert(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    screen + " 200% text overflow",
  );
  await page.addStyleTag({ content: "html{font-size:100%}" });
}
async function openRecipe(title) {
  await nav("Recipes");
  await page.getByRole("button", { name: "Explore", exact: true }).click();
  await page.getByRole("searchbox").fill(title);
  if (
    !(await page
      .locator(".recipe-filters")
      .getAttribute("open")
      .then((value) => value !== null))
  )
    await page.getByText("Filter recipes", { exact: true }).click();
  await page.getByLabel("Meal type", { exact: true }).selectOption("all");
  await page.getByLabel("Maximum time", { exact: true }).selectOption("0");
  await page.getByLabel("Avoid ingredients", { exact: true }).fill("");
  await page
    .locator(".recipe-card")
    .filter({ has: page.getByRole("heading", { name: title, exact: true }) })
    .getByRole("button", { name: "View recipe & plan" })
    .click();
}
async function saveMeal(date, slot, servings) {
  await page.getByLabel("Date", { exact: true }).fill(date);
  await page.getByLabel("Meal", { exact: true }).selectOption(slot);
  if (servings !== undefined)
    await page.getByLabel("Servings", { exact: true }).fill(String(servings));
  await page.getByRole("button", { name: "Save meal", exact: true }).click();
  await page.getByRole("status").filter({ hasText: "Meal saved" }).waitFor();
}
async function portions(meal, value) {
  await page.getByLabel(`Servings for ${meal}`).fill(String(value));
  await page
    .locator(".meal")
    .filter({
      has: page.getByRole("heading", {
        name: meal[0].toUpperCase() + meal.slice(1),
        exact: true,
      }),
    })
    .getByRole("button", { name: "Update servings" })
    .click();
  await page
    .getByRole("status")
    .filter({ hasText: "Meal portions updated" })
    .waitFor();
}
try {
  for (let i = 0; i < 100; i++) {
    if (server.exitCode !== null) throw new Error(output);
    try {
      if (output.includes(origin) && (await fetch(origin)).ok) break;
    } catch {}
    if (i === 99) throw new Error("Preview did not start");
    await delay(100);
  }
  context = await chromium.launchPersistentContext(profile, {
    executablePath,
    headless: true,
    ...devices["Pixel 7"],
  });
  context.on("page", (p) =>
    p.on("pageerror", (error) => errors.push(error.message)),
  );
  page = await context.newPage();
  await page.goto(origin);
  await page
    .getByRole("button", { name: "Download for offline use", exact: true })
    .click();
  await page.getByRole("status").filter({ hasText: "Ready offline" }).waitFor();
  await openRecipe("Garlic fried rice");
  await saveMeal("2026-11-22", "dinner", 2);
  await nav("Settings");
  await page.getByLabel("Default servings", { exact: true }).fill("4");
  await page.getByRole("button", { name: "Save default portions" }).click();
  await page
    .getByRole("status")
    .filter({ hasText: "Default portions saved" })
    .waitFor();
  await nav("Plan");
  assert.equal(await page.getByLabel("Servings for dinner").inputValue(), "2");
  await openRecipe("Fried egg");
  assert.equal(
    await page.getByLabel("Servings", { exact: true }).inputValue(),
    "4",
  );
  await saveMeal("2026-11-23", "breakfast");
  console.log(
    "PASS GUEST-01 defaults apply to new meals and preserve existing portions",
  );
  await nav("Recipes");
  await page.getByRole("searchbox").fill("SINÁNGAG");
  await page.getByText("Filter recipes", { exact: true }).click();
  assert.equal(await page.locator(".recipe-card").count(), 1);
  await page.getByLabel("Meal type", { exact: true }).selectOption("dinner");
  await page.getByRole("heading", { name: "No recipes found" }).waitFor();
  await page.getByRole("button", { name: "Reset search" }).click();
  await page.waitForFunction(
    () => document.querySelectorAll(".recipe-card").length === 2,
  );
  console.log(
    "PASS SEARCH-01 alias normalization, combined filters and empty/reset state",
  );
  await nav("Plan");
  await page.getByLabel("Plan date", { exact: true }).fill("2026-11-22");
  await page.getByLabel("Ingredients you have").fill("bawang");
  await page
    .getByRole("button", { name: "Add Garlic fried rice suggestion" })
    .click();
  await page
    .getByRole("status")
    .filter({ hasText: "Suggestion added" })
    .waitFor();
  assert.equal(
    await page.getByLabel("Servings for breakfast").inputValue(),
    "4",
  );
  await page
    .getByRole("button", { name: "Remove breakfast", exact: true })
    .click();
  await page.getByRole("button", { name: "Undo removal" }).click();
  await page.getByLabel("Servings for breakfast").waitFor();
  await portions("dinner", 3);
  await page.getByLabel("Suggestion meal").selectOption("lunch");
  await page
    .getByLabel("Avoid ingredients", { exact: true })
    .fill("bawang,itlog");
  await page
    .getByText("No meals fit these choices.", { exact: false })
    .waitFor();
  await page.getByLabel("Avoid ingredients", { exact: true }).fill("");
  console.log(
    "PASS SUG-01 and PLAN-01 empty-slot acceptance, filter explanation, remove/undo and Sunday portions",
  );
  await nav("Templates");
  await page.getByLabel("Template name").fill("Our rotation");
  await page.getByRole("button", { name: "Save week as template" }).click();
  await page
    .getByRole("status")
    .filter({ hasText: "Template saved" })
    .waitFor();
  await page
    .getByLabel("Saved template")
    .selectOption({ label: "Our rotation" });
  await page.getByLabel("Target week date").fill("2026-11-23");
  await page.getByRole("button", { name: "Preview template" }).click();
  await page.getByRole("heading", { name: "2 meals to apply" }).waitFor();
  await page.screenshot({
    path: "docs/evidence/phase-4-template.png",
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Apply template", exact: true })
    .click();
  await page
    .getByRole("status")
    .filter({ hasText: "Template applied" })
    .waitFor();
  await nav("Plan");
  await page.getByLabel("Plan date", { exact: true }).fill("2026-11-29");
  await page.getByLabel("Servings for dinner").waitFor();
  assert.equal(await page.getByLabel("Servings for dinner").inputValue(), "3");
  await portions("dinner", 5);
  await nav("Templates");
  await page
    .getByLabel("Saved template")
    .selectOption({ label: "Our rotation" });
  await page.getByRole("button", { name: "Preview template" }).click();
  await page.getByText("2 existing meals kept.").waitFor();
  assert(
    await page
      .getByRole("button", { name: "Apply template", exact: true })
      .isDisabled(),
  );
  await page.getByLabel("Replace existing meals (preview required)").check();
  await page.getByRole("button", { name: "Preview template" }).click();
  await page
    .getByText("This will replace 2 existing meals:", { exact: true })
    .waitFor();
  await page
    .getByRole("button", { name: "Apply template", exact: true })
    .click();
  await page
    .getByRole("status")
    .filter({ hasText: "Template applied" })
    .waitFor();
  console.log(
    "PASS TPL-01 relative-week preview, empty-only default and explicit replacement preview",
  );
  await nav("Groceries");
  const garlic = () =>
    page
      .locator(".grocery-list li")
      .filter({ hasText: "Garlic (minced)" })
      .getByRole("checkbox");
  const eggs = () =>
    page
      .locator(".grocery-list li")
      .filter({ hasText: "Egg (whole)" })
      .getByRole("checkbox");
  await garlic().check();
  await page
    .getByRole("status")
    .filter({ hasText: "Shopping progress saved" })
    .waitFor();
  await eggs().check();
  await page
    .getByRole("status")
    .filter({ hasText: "Shopping progress saved" })
    .waitFor();
  await page.screenshot({
    path: "docs/evidence/phase-4-groceries.png",
    fullPage: true,
  });
  await nav("Plan");
  await portions("dinner", 6);
  await nav("Groceries");
  await garlic().waitFor();
  assert.equal(await garlic().isChecked(), false);
  assert.equal(await eggs().isChecked(), true);
  console.log(
    "PASS SHOP-01 scaled consolidated groceries retain unchanged checks and reset changed quantities",
  );
  await nav("Recipes");
  await page.getByRole("button", { name: "New recipe", exact: true }).click();
  await page.getByRole("button", { name: "Save recipe", exact: true }).click();
  await page.getByText("Give your recipe a name.", { exact: true }).waitFor();
  await audit("Editor validation");
  await page.getByLabel("Recipe name", { exact: true }).fill("Market beans");
  await page.getByLabel("Recipe yield").fill("2");
  await page.getByLabel("Prep minutes", { exact: true }).fill("5");
  await page.getByLabel("Cook minutes", { exact: true }).fill("10");
  await page.getByLabel("Ingredient name", { exact: true }).fill("Beans");
  await page.getByLabel("Amount", { exact: true }).fill("500");
  await page.getByLabel("Unit", { exact: true }).fill("g");
  await page
    .getByLabel("Step instructions", { exact: true })
    .fill("Simmer the beans until tender.");
  await page.evaluate(() => {
    window.originalRecipePut = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function (...args) {
      if (this.name === "userRecipes")
        throw new DOMException("Simulated full storage", "QuotaExceededError");
      return window.originalRecipePut.apply(this, args);
    };
  });
  await page.getByRole("button", { name: "Save recipe", exact: true }).click();
  await page
    .getByRole("alert")
    .filter({ hasText: "Simulated full storage" })
    .waitFor();
  assert.equal(
    await page.getByLabel("Recipe name", { exact: true }).inputValue(),
    "Market beans",
  );
  await page.evaluate(() => {
    IDBObjectStore.prototype.put = window.originalRecipePut;
  });
  await page.getByRole("button", { name: "Save recipe", exact: true }).click();
  await page
    .getByRole("heading", { name: "Market beans", exact: true })
    .waitFor();
  await audit("Recipe detail");
  await saveMeal("2026-11-30", "dinner", 4);
  await nav("Templates");
  await page.getByLabel("Template name").fill("Bean week");
  await page.getByRole("button", { name: "Save week as template" }).click();
  await page
    .getByRole("status")
    .filter({ hasText: "Template saved" })
    .waitFor();
  await openRecipe("Market beans");
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Archive recipe" }).click();
  await page
    .getByRole("status")
    .filter({ hasText: "Recipe archived" })
    .waitFor();
  await nav("Plan");
  await page.getByRole("button", { name: "Market beans", exact: true }).click();
  await page
    .getByText("Archived recipe · this saved meal keeps its original content.")
    .waitFor();
  await nav("Templates");
  await page.getByLabel("Saved template").selectOption({ label: "Bean week" });
  await page.getByLabel("Target week date").fill("2026-12-07");
  await page.getByRole("button", { name: "Preview template" }).click();
  await page.getByRole("heading", { name: "Skipped meals" }).waitFor();
  assert(
    await page
      .getByRole("button", { name: "Apply template", exact: true })
      .isDisabled(),
  );
  await openRecipe("Garlic fried rice");
  await page.getByRole("button", { name: "Remix recipe" }).click();
  await page
    .getByLabel("Recipe name", { exact: true })
    .fill("Family garlic rice");
  await page.getByRole("button", { name: "Save recipe", exact: true }).click();
  await page
    .getByRole("heading", { name: "Family garlic rice", exact: true })
    .waitFor();
  await page.getByRole("button", { name: "Edit recipe", exact: true }).click();
  assert(
    await page
      .locator("main h1")
      .evaluate((el) => el === document.activeElement),
  );
  await page
    .getByLabel("Description", { exact: true })
    .fill("Our saved family variation");
  await page.getByRole("button", { name: "Keep draft & back" }).click();
  await openRecipe("Family garlic rice");
  await page.getByRole("button", { name: "Edit recipe", exact: true }).click();
  assert.equal(
    await page.getByLabel("Description", { exact: true }).inputValue(),
    "Our saved family variation",
  );
  await page.getByRole("button", { name: "Save recipe", exact: true }).click();
  await page
    .getByRole("heading", { name: "Family garlic rice", exact: true })
    .waitFor();
  await page.getByRole("button", { name: "Cook now", exact: true }).click();
  assert(
    await page
      .locator("main h1")
      .evaluate((el) => el === document.activeElement),
  );
  await page.getByText("Step 1 of 2", { exact: true }).waitFor();
  await page
    .getByRole("button", { name: "Start 1 min timer", exact: true })
    .click();
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await page.getByText("Step 2 of 2", { exact: true }).waitFor();
  await page.screenshot({
    path: "docs/evidence/phase-4-cooking.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Exit cooking" }).click();
  await nav("Recipes");
  await page.getByRole("button", { name: "New recipe", exact: true }).click();
  await page.getByLabel("Recipe name", { exact: true }).fill("Unfinished soup");
  await page.getByRole("button", { name: "Keep draft & back" }).click();
  await openRecipe("Family garlic rice");
  page.once("dialog", (dialog) => dialog.dismiss());
  await page.getByRole("button", { name: "Edit recipe", exact: true }).click();
  await page.getByRole("heading", { name: "Recipes", exact: true }).waitFor();
  await page.getByRole("button", { name: "New recipe", exact: true }).click();
  assert.equal(
    await page.getByLabel("Recipe name", { exact: true }).inputValue(),
    "Unfinished soup",
  );
  console.log(
    "PASS EDIT-01 create/validation, independent remix, archived plan snapshot, missing template reference and saved draft",
  );
  await context.close();
  context = await chromium.launchPersistentContext(profile, {
    executablePath,
    headless: true,
    offline: true,
    ...devices["Pixel 7"],
  });
  context.on("page", (p) =>
    p.on("pageerror", (error) => errors.push(error.message)),
  );
  page = await context.newPage();
  await page.clock.install({ time: new Date(Date.now() + 120000) });
  await page.goto(origin + "/plan");
  await page.getByRole("heading", { name: "Your week", exact: true }).waitFor();
  await page
    .getByRole("button", { name: "Market beans", exact: true })
    .waitFor();
  assert.equal(await page.getByLabel("Servings for dinner").inputValue(), "4");
  await page.getByRole("button", { name: /Resume cooking · step 2/ }).click();
  await page.getByText("Step 2 of 2", { exact: true }).waitFor();
  await page.getByRole("alert").filter({ hasText: "Timer finished" }).waitFor();
  await page.getByRole("button", { name: "Previous", exact: true }).click();
  await page.getByText("Step 1 of 2", { exact: true }).waitFor();
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await page.getByRole("button", { name: "Dismiss timer" }).click();
  await page.getByText("All ingredients", { exact: true }).click();
  await audit("Cooking resumed offline");
  await page.screenshot({
    path: "docs/evidence/phase-4-cooking-offline.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Exit cooking" }).click();
  await nav("Settings");
  assert.equal(
    await page.getByLabel("Default servings", { exact: true }).inputValue(),
    "4",
  );
  await nav("Recipes");
  await page.getByRole("button", { name: "New recipe", exact: true }).click();
  assert.equal(
    await page.getByLabel("Recipe name", { exact: true }).inputValue(),
    "Unfinished soup",
  );
  await page.getByLabel("Recipe name", { exact: true }).fill("Offline soup");
  await page.getByLabel("Ingredient name", { exact: true }).fill("Tomatoes");
  await page.getByLabel("Amount", { exact: true }).fill("2");
  await page.getByLabel("Unit", { exact: true }).fill("piece");
  await page
    .getByLabel("Step instructions", { exact: true })
    .fill("Cook until softened.");
  await page.getByRole("button", { name: "Save recipe", exact: true }).click();
  await page
    .getByRole("heading", { name: "Offline soup", exact: true })
    .waitFor();
  await nav("Templates");
  await page
    .getByLabel("Saved template")
    .selectOption({ label: "Our rotation" });
  await page.getByLabel("Target week date").fill("2026-12-14");
  await page.getByRole("button", { name: "Preview template" }).click();
  await page
    .getByRole("button", { name: "Apply template", exact: true })
    .click();
  await page
    .getByRole("status")
    .filter({ hasText: "Template applied" })
    .waitFor();
  await nav("Plan");
  await page.getByLabel("Plan date", { exact: true }).fill("2026-12-20");
  await page.getByLabel("Suggestion meal").selectOption("lunch");
  await page
    .getByRole("button", { name: "Add Offline soup suggestion" })
    .click();
  await page
    .getByRole("status")
    .filter({ hasText: "Suggestion added" })
    .waitFor();
  await nav("Groceries");
  await page.getByText("Tomatoes", { exact: true }).waitFor();
  console.log(
    "PASS COOK-01/OFF-01 full browser restart restores timer/step; preferences, templates, local editing, suggestions and groceries work offline",
  );
  for (const destination of [
    "Recipes",
    "Plan",
    "Templates",
    "Groceries",
    "Settings",
  ]) {
    await nav(destination);
    await audit(destination);
  }
  await nav("Recipes");
  await page.getByRole("searchbox").fill("");
  await page.screenshot({
    path: "docs/evidence/phase-4-recipes.png",
    fullPage: true,
  });
  await page.addStyleTag({ content: "html{font-size:200%}" });
  assert(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    "Phone 200% text overflow",
  );
  await page.addStyleTag({ content: "html{font-size:100%}" });
  await page.setViewportSize({ width: 1280, height: 900 });
  assert(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  );
  await page.screenshot({
    path: "docs/evidence/phase-4-desktop.png",
    fullPage: true,
  });
  await page.emulateMedia({ reducedMotion: "reduce" });
  assert.equal(
    await page
      .getByRole("button", { name: "New recipe", exact: true })
      .evaluate((el) => getComputedStyle(el).transitionDuration),
    "0s",
  );
  await page.keyboard.press("Tab");
  assert(
    await page.evaluate(() => document.activeElement !== document.body),
    "Keyboard focus stays on an interactive control",
  );
  assert.deepEqual(errors, [], "No unhandled browser exceptions");
  console.log(
    "PASS reference-style phone/desktop render, accessibility and high text scaling",
  );
} catch (error) {
  await page
    ?.screenshot({ path: "docs/evidence/phase-4-failure.png", fullPage: true })
    .catch(() => {});
  throw error;
} finally {
  await context?.close();
  server.kill();
  if (
    dirname(resolve(profile)) === resolve(tmpdir()) &&
    basename(profile).startsWith("ulam-phase4-")
  )
    rmSync(profile, {
      recursive: true,
      force: true,
      maxRetries: 3,
      retryDelay: 200,
    });
}
