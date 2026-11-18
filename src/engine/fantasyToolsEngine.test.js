import test from "node:test";
import assert from "node:assert/strict";
import { createLegendPlayer } from "./fantasyToolsEngine.js";

test("legend creation requires an explicit playing profile", () => {
  const result = createLegendPlayer({ name: "Test Legend" }, "Collingwood");
  assert.match(result.error, /Enter a valid age, position/);
});

test("legend creation preserves the supplied profile and contract", () => {
  const result = createLegendPlayer(
    { name: "Test Legend", games: 200 },
    "Collingwood",
    { age: 27, positions: ["HF", "MID"], overall: 91, potential: 94, heightCm: 188, salary: 750000, yearsRemaining: 2 },
  );

  assert.equal(result.error, undefined);
  assert.equal(result.player.age, 27);
  assert.deepEqual(result.player.positions, ["HF", "MID"]);
  assert.equal(result.player.overall, 91);
  assert.equal(result.player.development.potential, 94);
  assert.equal(result.player.heightCm, 188);
  assert.equal(result.contract.salary, 750000);
  assert.equal(result.contract.yearsRemaining, 2);
  assert.ok(result.player.attributes && Object.keys(result.player.attributes).length > 0);
});
