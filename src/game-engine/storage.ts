import type { Game } from "./types";
import { cards, finalCard } from "../content/cards";
export type Save = { game: Game; history: Game[] };
const KEY = "gradus-save-v1";
export function validGame(value: unknown): value is Game {
  try {
    const g = value as Game;
    if (
      g.card !== null &&
      ![...cards, finalCard].some(
        (c) => JSON.stringify(c) === JSON.stringify(g.card),
      )
    )
      return false;
    return (
      g.version === 1 &&
      Array.isArray(g.players) &&
      g.players.length >= 2 &&
      g.players.length <= 15 &&
      g.players.every(
        (p, i) =>
          p.id === `p${i + 1}` &&
          typeof p.name === "string" &&
          p.name.length > 0 &&
          p.name.length <= 24 &&
          typeof p.color === "string" &&
          Number.isInteger(p.position) &&
          p.position >= 0 &&
          p.position <= 30 &&
          typeof p.sabotage === "boolean",
      ) &&
      Number.isInteger(g.active) &&
      g.active >= 0 &&
      g.active < g.players.length &&
      Number.isInteger(g.turn) &&
      g.turn > 0 &&
      typeof g.result === "string" &&
      (g.die === null ||
        (Number.isInteger(g.die) && g.die >= 1 && g.die <= 6)) &&
      ["roll", "card", "final", "result", "won"].includes(g.phase) &&
      Array.isArray(g.reminders) &&
      g.reminders.length <= 2 &&
      g.reminders.every(
        (r) =>
          typeof r.id === "string" &&
          typeof r.text === "string" &&
          typeof r.expires === "string" &&
          typeof r.owner === "string",
      ) &&
      Array.isArray(g.moves) &&
      g.moves.every(
        (m) =>
          g.players.some((p) => p.id === m.player) &&
          Number.isFinite(m.from) &&
          Number.isFinite(m.to),
      ) &&
      Array.isArray(g.pendingFinal) &&
      g.pendingFinal.every((id) => g.players.some((p) => p.id === id)) &&
      (g.recipient === null || g.players.some((p) => p.id === g.recipient)) &&
      (g.randomTarget === null ||
        g.players.some((p) => p.id === g.randomTarget)) &&
      (g.finalPlayer === null ||
        g.players.some((p) => p.id === g.finalPlayer)) &&
      (g.winner === null || g.players.some((p) => p.id === g.winner)) &&
      (g.phase !== "final" || (!!g.finalPlayer && g.card?.id === "final")) &&
      (g.phase !== "won" || !!g.winner) &&
      (g.phase !== "card" ||
        (!!g.card && cards.some((c) => c.id === g.card!.id))) &&
      ["voice", "body", "chaos"].every(
        (c) =>
          Array.isArray(g.decks[c as keyof typeof g.decks]) &&
          g.decks[c as keyof typeof g.decks].every((id) =>
            cards.some((card) => card.id === id),
          ),
      )
    );
  } catch {
    return false;
  }
}
export function load(): Save | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const s = JSON.parse(raw);
    return validGame(s.game)
      ? {
          game: s.game,
          history: Array.isArray(s.history)
            ? s.history.filter(validGame).slice(-20)
            : [],
        }
      : null;
  } catch {
    return null;
  }
}
export function save(s: Save): boolean {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
    return true;
  } catch {
    return false;
  }
}
export function clearSave() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* Private storage may be unavailable. */
  }
}
