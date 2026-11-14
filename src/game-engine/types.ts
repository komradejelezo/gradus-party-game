export type Category = "voice" | "body" | "chaos";
export type Resolution = "Выполни" | "Угадай" | "Суд компании" | "Дуэль";
export type Effect = {
  success: number;
  failure: number;
  target?: "random";
  targetSuccess?: number;
  targetFailure?: number;
  reminder?: string;
};
export type Card = {
  id: string;
  category: Category;
  title: string;
  instruction: string;
  transferInstruction?: string;
  resolution: Resolution;
  duration: number;
  participation: string;
  effect: Effect;
  toast?: boolean;
};
export type Player = {
  id: string;
  name: string;
  color: string;
  position: number;
  sabotage: boolean;
};
export type Reminder = {
  id: string;
  text: string;
  owner: string;
  expires: string;
};
export type Game = {
  version: 1;
  players: Player[];
  active: number;
  phase: "roll" | "card" | "final" | "result" | "won";
  turn: number;
  die: number | null;
  card: Card | null;
  recipient: string | null;
  randomTarget: string | null;
  decks: Record<Category, string[]>;
  reminders: Reminder[];
  pendingFinal: string[];
  finalPlayer: string | null;
  winner: string | null;
  result: string;
  moves: { player: string; from: number; to: number }[];
};
