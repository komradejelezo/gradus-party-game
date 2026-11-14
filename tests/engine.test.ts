import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createGame,
  roll,
  resolve,
  next,
  sabotage,
  clamp,
  dismissReminder,
} from "../src/game-engine/engine";
import { validGame } from "../src/game-engine/storage";
import { cards } from "../src/content/cards";
import { board } from "../src/content/board";
import type { Game } from "../src/game-engine/types";
const fresh = () => createGame(["Аня", "Борис"]);
function withCard(id: string): Game {
  const g = fresh();
  g.phase = "card";
  g.card = cards.find((c) => c.id === id)!;
  g.players[0].position = 10;
  g.players[1].position = 8;
  if (g.card.effect.target) g.randomTarget = "p2";
  return g;
}
test("2–15 players; invalid sizes and names rejected", () => {
  assert.equal(
    createGame(Array.from({ length: 15 }, (_, i) => `Игрок ${i}`)).players
      .length,
    15,
  );
  for (const names of [["А"], Array(16).fill("А"), ["", "Б"]])
    assert.throws(() => createGame(names));
});
test("board has 30 spaces, balanced categories, no runs", () => {
  assert.equal(board.length, 30);
  for (const c of ["voice", "body", "chaos"])
    assert.equal(board.filter((x) => x === c).length, 10);
  board.forEach((c, i) => {
    if (i > 0) assert.notEqual(c, board[i - 1]);
  });
});
test("39 unique, typed, printable cards with all checks", () => {
  assert.equal(cards.length, 39);
  assert.equal(new Set(cards.map((c) => c.id)).size, 39);
  assert.equal(new Set(cards.map((c) => c.instruction)).size, 39);
  for (const category of ["voice", "body", "chaos"])
    assert.equal(cards.filter((c) => c.category === category).length, 13);
  assert.equal(new Set(cards.map((c) => c.resolution)).size, 4);
  assert.ok(cards.filter((c) => c.toast).length >= 13);
});
test("roll moves once; invalid and repeated rolls are no-ops; state immutable", () => {
  const g = fresh();
  assert.equal(roll(g, 7), g);
  const n = roll(g, 3, () => 0);
  assert.equal(n.players[0].position, 3);
  assert.equal(n.phase, "card");
  assert.equal(g.players[0].position, 0);
  assert.equal(roll(n, 6), n);
  assert.equal(n.card?.category, board[2]);
});
test("basic success/failure and no new cards for bonus movements", () => {
  const g = withCard("voice-01");
  const success = resolve(g, true);
  assert.equal(success.players[0].position, 11);
  assert.equal(resolve(g, false).players[0].position, 9);
  assert.equal(success.card?.id, g.card?.id);
  assert.equal(success.phase, "result");
  assert.equal(resolve(success, true), success);
});
test("duel +2 or zero", () => {
  const g = withCard("voice-11");
  assert.equal(resolve(g, true).players[0].position, 12);
  assert.equal(resolve(g, false).players[0].position, 10);
});
test("chaos overrides +3 / -2", () => {
  const g = withCard("chaos-13");
  assert.equal(resolve(g, true).players[0].position, 13);
  assert.equal(resolve(g, false).players[0].position, 8);
});
test("position boundaries 0 and 30", () => {
  assert.equal(clamp(-1), 0);
  assert.equal(clamp(34), 30);
  const g = withCard("chaos-13");
  g.players[0].position = 0;
  assert.equal(resolve(g, false).players[0].position, 0);
  g.players[0].position = 29;
  assert.equal(resolve(g, true).players[0].position, 30);
});
test("decks do not repeat until cycle exhaustion", () => {
  let g = fresh();
  const seen = new Set();
  for (let i = 0; i < 14; i++) {
    g.phase = "roll";
    g.players[g.active].position = 0;
    g = roll(g, 1, () => 0);
    if (i < 13) {
      assert.ok(!seen.has(g.card!.id));
      seen.add(g.card!.id);
    } else {
      assert.ok(seen.has(g.card!.id));
      assert.equal(g.decks.voice.length, 1);
    }
  }
  assert.equal(seen.size, 13);
});
test("personal sabotage consumes token, cannot repeat or self-target", () => {
  const g = withCard("body-01");
  assert.equal(sabotage(g, "p1"), g);
  assert.equal(sabotage(g, "missing"), g);
  const n = sabotage(g, "p2");
  assert.equal(n.players[0].sabotage, false);
  assert.equal(n.recipient, "p2");
  assert.equal(sabotage(n, "p2"), n);
  const good = resolve(n, true);
  assert.deepEqual(
    good.players.map((p) => p.position),
    [9, 10],
  );
  const bad = resolve(n, false);
  assert.deepEqual(
    bad.players.map((p) => p.position),
    [11, 7],
  );
  assert.equal(next(good).active, 1);
});
test("random sabotage is separate and costs no token", () => {
  const g = withCard("chaos-01");
  assert.deepEqual(
    resolve(g, true).players.map((p) => p.position),
    [9, 10],
  );
  assert.deepEqual(
    resolve(g, false).players.map((p) => p.position),
    [11, 7],
  );
  assert.ok(resolve(g, true).players[0].sabotage);
});
test("personal transfer overrides all printed chaos effects", () => {
  const n = resolve(sabotage(withCard("chaos-13"), "p2"), true);
  assert.deepEqual(
    n.players.map((p) => p.position),
    [9, 10],
  );
});
test("random target excludes active, assigned once at card draw", () => {
  const g = roll(fresh(), 3, () => 0);
  assert.equal(g.card?.id, "chaos-01");
  assert.equal(g.randomTarget, "p2");
});
test("roll to 30 starts final directly, final not transferable", () => {
  const g = fresh();
  g.players[0].position = 28;
  const n = roll(g, 6);
  assert.equal(n.phase, "final");
  assert.equal(n.card?.id, "final");
  assert.equal(n.finalPlayer, "p1");
  assert.equal(sabotage(n, "p2"), n);
  assert.equal(resolve(n, true).phase, "won");
  assert.equal(resolve(n, true).winner, "p1");
  const bad = resolve(n, false);
  assert.equal(bad.players[0].position, 27);
  assert.equal(next(bad).active, 1);
});
test("bonus reaching 30 queues final before next player", () => {
  const g = withCard("voice-01");
  g.players[0].position = 29;
  const n = next(resolve(g, true));
  assert.equal(n.phase, "final");
  assert.equal(n.finalPlayer, "p1");
  assert.equal(n.active, 0);
});
test("sabotaged recipient reaching 30 gets their own final immediately", () => {
  const g = withCard("voice-01");
  g.players[1].position = 28;
  const n = next(resolve(sabotage(g, "p2"), true));
  assert.equal(n.phase, "final");
  assert.equal(n.finalPlayer, "p2");
  assert.equal(resolve(n, true).winner, "p2");
  assert.equal(next(resolve(n, false)).active, 1);
});
test("two finishers receive finals in priority order, no skipped finalist", () => {
  const g = withCard("chaos-01");
  g.card = {
    ...g.card!,
    effect: { success: 1, failure: 0, target: "random", targetSuccess: 2 },
  };
  g.players[0].position = 29;
  g.players[1].position = 28;
  let n = next(resolve(g, true));
  assert.equal(n.finalPlayer, "p1");
  n = next(resolve(n, false));
  assert.equal(n.finalPlayer, "p2");
  assert.equal(resolve(n, true).winner, "p2");
});
test("temporary reminders capped at two and close manually", () => {
  let g = withCard("chaos-02");
  for (let i = 0; i < 4; i++) {
    g.phase = "card";
    g.turn = i + 1;
    g = resolve(g, true);
  }
  assert.equal(g.reminders.length, 2);
  assert.equal(dismissReminder(g, g.reminders[0].id).reminders.length, 1);
});
test("cyclic turn order works for 15 players", () => {
  let g = createGame(Array.from({ length: 15 }, (_, i) => `Игрок ${i + 1}`));
  for (let i = 0; i < 15; i++) {
    assert.equal(g.active, i);
    g = next(
      resolve(
        roll(g, 1, () => 0),
        false,
      ),
    );
  }
  assert.equal(g.active, 0);
  assert.equal(g.turn, 16);
});
test("serialized mid-card transfer restores all engine state", () => {
  const g = sabotage(
    roll(fresh(), 3, () => 0),
    "p2",
  );
  const restored = JSON.parse(JSON.stringify(g));
  assert.ok(validGame(restored));
  assert.deepEqual(resolve(restored, true), resolve(g, true));
  assert.equal(validGame({}), false);
  assert.equal(validGame({ ...g, players: [] }), false);
});
test("full deterministic game reaches victory", () => {
  let g = fresh();
  let steps = 0;
  while (g.phase !== "won" && steps++ < 200) {
    if (g.phase === "roll") g = roll(g, 6, () => 0.6);
    else if (g.phase === "result") g = next(g);
    else g = resolve(g, true);
  }
  assert.equal(g.phase, "won");
  assert.ok(steps < 200);
});
test("damaged card or final state is rejected without rendering", () => {
  const g = roll(fresh(), 1, () => 0);
  assert.equal(validGame({ ...g, card: { id: g.card!.id } }), false);
  assert.equal(validGame({ ...g, phase: "final", finalPlayer: null }), false);
  assert.equal(validGame({ ...g, die: 9 }), false);
});
