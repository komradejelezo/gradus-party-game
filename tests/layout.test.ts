import { test } from "node:test";
import assert from "node:assert/strict";
import { trackPoint } from "../src/ui/board-layout";

test("all 30 circular spaces fit inside the track and remain separated", () => {
  const points = Array.from({ length: 30 }, (_, i) => trackPoint(i + 1));
  for (const [i, p] of points.entries()) {
    assert.ok(
      p.x > 40 && p.x < 960 && p.y > 40 && p.y < 660,
      `Space ${i + 1} stays inside the canvas`,
    );
    for (const q of points.slice(i + 1))
      assert.ok(
        Math.hypot(p.x - q.x, p.y - q.y) > 80,
        "Circles and docked groups must not obscure adjacent spaces",
      );
  }
});
test("fractional positions move continuously along every bend, including start and finish", () => {
  for (let i = 0; i < 3000; i++) {
    const a = trackPoint(i / 100),
      b = trackPoint((i + 1) / 100);
    assert.ok(
      Math.hypot(a.x - b.x, a.y - b.y) < 2,
      "No teleporting across a loop",
    );
  }
  assert.deepEqual(trackPoint(-1), trackPoint(0));
  assert.deepEqual(trackPoint(31), trackPoint(30));
});
