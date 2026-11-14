import type { Game, Category } from "./types";
import { board, colors } from "../content/board";
import { cards, finalCard } from "../content/cards";
export const clamp = (n: number) => Math.max(0, Math.min(30, n));
const sample = <T>(items: T[], rng: () => number) =>
  items[Math.min(items.length - 1, Math.floor(rng() * items.length))];
export function createGame(names: string[]): Game {
  if (
    names.length < 2 ||
    names.length > 15 ||
    names.some((n) => !n.trim() || n.trim().length > 24)
  )
    throw new Error("Нужно от 2 до 15 имён длиной до 24 символов.");
  return {
    version: 1,
    players: names.map((name, i) => ({
      id: `p${i + 1}`,
      name: name.trim(),
      color: colors[i],
      position: 0,
      sabotage: true,
    })),
    active: 0,
    phase: "roll",
    turn: 1,
    die: null,
    card: null,
    recipient: null,
    randomTarget: null,
    decks: { voice: [], body: [], chaos: [] },
    reminders: [],
    pendingFinal: [],
    finalPlayer: null,
    winner: null,
    result: "",
    moves: [],
  };
}
function move(g: Game, id: string, delta: number) {
  const p = g.players.find((p) => p.id === id)!;
  const from = p.position;
  p.position = clamp(from + delta);
  g.moves.push({ player: id, from, to: p.position });
}
function queueFinals(g: Game) {
  // Active player has priority when one outcome takes two players to the finish.
  const order = [
    g.players[g.active],
    ...g.players.filter((_, i) => i !== g.active),
  ];
  g.pendingFinal = order.filter((p) => p.position === 30).map((p) => p.id);
}
function startFinal(g: Game) {
  g.finalPlayer = g.pendingFinal.shift()!;
  g.phase = "final";
  g.card = finalCard;
  g.recipient = null;
  g.randomTarget = null;
}
function draw(g: Game, category: Category, rng: () => number) {
  let available = cards.filter(
    (c) => c.category === category && !g.decks[category].includes(c.id),
  );
  if (!available.length) {
    g.decks[category] = [];
    available = cards.filter((c) => c.category === category);
  }
  const card = sample(available, rng);
  g.decks[category].push(card.id);
  g.card = card;
  g.randomTarget =
    card.effect.target === "random"
      ? sample(
          g.players.filter((p) => p.id !== g.players[g.active].id),
          rng,
        ).id
      : null;
}
export function roll(g: Game, die: number, rng = Math.random): Game {
  if (g.phase !== "roll" || !Number.isInteger(die) || die < 1 || die > 6)
    return g;
  const n = structuredClone(g);
  n.die = die;
  n.moves = [];
  n.result = "";
  n.recipient = null;
  n.randomTarget = null;
  move(n, n.players[n.active].id, die);
  if (n.players[n.active].position === 30) {
    queueFinals(n);
    startFinal(n);
  } else {
    draw(n, board[n.players[n.active].position - 1], rng);
    n.phase = "card";
  }
  return n;
}
export function sabotage(g: Game, target: string): Game {
  if (
    g.phase !== "card" ||
    g.recipient ||
    !g.players[g.active].sabotage ||
    target === g.players[g.active].id ||
    !g.players.some((p) => p.id === target)
  )
    return g;
  const n = structuredClone(g);
  n.players[n.active].sabotage = false;
  n.recipient = target;
  return n;
}
export function resolve(g: Game, success: boolean): Game {
  if (g.phase !== "card" && g.phase !== "final") return g;
  const n = structuredClone(g);
  n.moves = [];
  if (n.phase === "final") {
    const id = n.finalPlayer!;
    const player = n.players.find((p) => p.id === id)!;
    if (success) {
      n.winner = id;
      n.phase = "won";
      n.result = `${player.name} — победитель!`;
      return n;
    }
    move(n, id, -3);
    n.result = `${player.name}: финал не пройден. Возвращение на 27.`;
    n.finalPlayer = null;
    n.phase = "result";
    return n;
  }
  const actor = n.players[n.active];
  const e = n.card!.effect;
  if (n.recipient) {
    move(n, actor.id, success ? -1 : 1);
    move(n, n.recipient, success ? 2 : -1);
  } else {
    move(n, actor.id, success ? e.success : e.failure);
    if (n.randomTarget)
      move(
        n,
        n.randomTarget,
        success ? (e.targetSuccess ?? 0) : (e.targetFailure ?? 0),
      );
  }
  if (success && !n.recipient && e.reminder) {
    n.reminders = [
      ...n.reminders,
      {
        id: `${n.turn}-${n.card!.id}`,
        text: e.reminder,
        owner: actor.name,
        expires: `После хода ${n.turn + 1} · ведущий закрывает вручную`,
      },
    ].slice(-2);
  }
  n.result =
    (success ? "Засчитано. " : "Провал. ") +
    n.moves
      .map((m) => {
        const p = n.players.find((p) => p.id === m.player)!;
        const delta = m.to - m.from;
        return `${p.name}: ${delta > 0 ? "+" : ""}${delta} → ${m.to}`;
      })
      .join(" · ");
  queueFinals(n);
  n.phase = "result";
  return n;
}
export function next(g: Game): Game {
  if (g.phase !== "result") return g;
  const n = structuredClone(g);
  n.moves = [];
  if (n.pendingFinal.length) {
    startFinal(n);
    return n;
  }
  n.active = (n.active + 1) % n.players.length;
  n.turn++;
  n.phase = "roll";
  n.card = null;
  n.die = null;
  n.recipient = null;
  n.randomTarget = null;
  n.finalPlayer = null;
  return n;
}
export function dismissReminder(g: Game, id: string): Game {
  return { ...g, reminders: g.reminders.filter((r) => r.id !== id) };
}
