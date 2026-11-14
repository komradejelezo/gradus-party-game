import { mkdirSync, writeFileSync } from "node:fs";
import { cards, finalCard } from "../src/content/cards";
import { board } from "../src/content/board";
mkdirSync("exports", { recursive: true });
writeFileSync(
  "exports/gradus.json",
  JSON.stringify({ board, cards, finalCard }, null, 2),
);
const rows = [
  [
    "ID",
    "Категория",
    "Название",
    "Задание",
    "Проверка",
    "Секунды",
    "Участники",
    "Эффект",
    "Тост",
  ],
  ...[...cards, finalCard].map((c) => [
    c.id,
    c.category,
    c.title,
    c.instruction,
    c.resolution,
    c.duration,
    c.participation,
    JSON.stringify(c.effect),
    c.toast ? "Да" : "Нет",
  ]),
];
writeFileSync(
  "exports/gradus.csv",
  "\uFEFF" +
    rows
      .map((row) =>
        row.map((v) => '"' + String(v).replaceAll('"', '""') + '"').join(";"),
      )
      .join("\n"),
);
console.log("Экспорт готов: exports/gradus.json и exports/gradus.csv");
