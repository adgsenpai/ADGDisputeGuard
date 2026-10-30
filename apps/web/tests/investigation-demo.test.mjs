import test from "node:test";
import assert from "node:assert/strict";
import { advanceLoop, initialLoopState } from "../lib/investigation-demo.ts";
import { demoCards } from "../lib/demo-transactions.ts";

function run(scenario) {
  let state = initialLoopState;
  for (let i = 0; i < 20; i++) {
    const next = advanceLoop(state, scenario);
    if (next === state) return state;
    state = next;
  }
  assert.fail("Demo failed to terminate");
}

test("complete investigation records three observations before human review", () => {
  const result = run("complete");
  assert.equal(result.stage, "review");
  assert.equal(result.toolCalls, 3);
  assert.equal(result.observations, 3);
  assert.equal(result.iteration, 3);
});
test("budget exhaustion stops before a third tool call", () => {
  const result = run("budget");
  assert.equal(result.stage, "stopped");
  assert.equal(result.iteration, 2);
  assert.equal(result.toolCalls, 2);
  assert.match(result.history.at(-1), /budget reached/);
});
test("disallowed tool is blocked before execution and observation", () => {
  const result = run("blocked");
  assert.equal(result.stage, "stopped");
  assert.equal(result.toolCalls, 1);
  assert.equal(result.observations, 1);
  assert.match(result.history.at(-1), /issue_refund is not an allowed/);
});
test("terminal states cannot continue and reset state remains pristine", () => {
  for (const scenario of ["complete", "budget", "blocked"]) {
    const result = run(scenario);
    assert.equal(advanceLoop(result, scenario), result);
  }
  assert.equal(initialLoopState.stage, "context");
  assert.equal(initialLoopState.history.length, 1);
});
test("sample transactions use unique references and exact positive minor units", () => {
  const transactions = demoCards.flatMap((card) => card.transactions);
  assert.equal(
    new Set(transactions.map((transaction) => transaction.id)).size,
    transactions.length,
  );
  assert.ok(
    transactions.every(
      (transaction) =>
        Number.isSafeInteger(transaction.amountMinor) &&
        transaction.amountMinor > 0,
    ),
  );
});
