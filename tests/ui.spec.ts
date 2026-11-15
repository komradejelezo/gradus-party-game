import { test, expect, type Page } from "@playwright/test";
import { createGame, roll, sabotage } from "../src/game-engine/engine";
import type { Game } from "../src/game-engine/types";
async function open(page: Page) {
  await page.addInitScript(() => sessionStorage.setItem("gradus-intro", "1"));
  await page.goto("./");
}
async function seed(page: Page, game: Game) {
  await open(page);
  await page.evaluate(
    (game) =>
      localStorage.setItem(
        "gradus-save-v1",
        JSON.stringify({ game, history: [] }),
      ),
    game,
  );
  await page.reload();
  await page.getByRole("button", { name: /Продолжить/ }).click();
}
async function start(page: Page) {
  await open(page);
  await page.getByRole("button", { name: "Начать игру", exact: true }).click();
  await page.getByLabel("Имя игрока 1").fill("Аня");
  await page.getByLabel("Имя игрока 2").fill("Борис");
  await page.getByRole("button", { name: "Все в сборе" }).click();
  await page
    .getByRole("button", { name: "Начать · пропустить объяснение" })
    .click();
}

test("создание партии, бросок, подстава, перезагрузка, результат, отмена", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await start(page);
  await expect(page.locator(".space")).toHaveCount(30);
  await page.getByRole("button", { name: "Бросить кубик" }).click();
  const card = page.locator("dialog.task-card");
  await expect(card).toBeVisible();
  const title = await card.locator("h2").innerText();
  await card.getByRole("button", { name: /Подставить друга/ }).click();
  await card.getByRole("button", { name: "Борис", exact: true }).click();
  await expect(page.locator(".task-player")).toContainText("Борис");
  await page.reload();
  await page.getByRole("button", { name: /Продолжить/ }).click();
  await expect(card.locator("h2")).toHaveText(title);
  await expect(page.locator(".task-player")).toContainText("Борис");
  await card.getByRole("button", { name: "✓ Засчитано" }).click();
  await expect(card).not.toBeVisible();
  await page
    .getByRole("button", { name: "Отменить последнее действие" })
    .click();
  await expect(card).toBeVisible();
  await expect(page.locator(".task-player")).toContainText("Борис");
  await card.getByRole("button", { name: "× Провал" }).click();
  await page.getByRole("button", { name: "Следующий игрок" }).click();
  await expect(page.locator(".current-name")).toContainText("Борис");
  expect(errors).toEqual([]);
});
test("15 игроков, общая клетка, планшет и узкий экран", async ({ page }) => {
  const g = createGame(Array.from({ length: 15 }, (_, i) => `Гость ${i + 1}`));
  g.players.forEach((p) => (p.position = 10));
  await seed(page, g);
  await expect(page.locator(".roster-player")).toHaveCount(15);
  await expect(
    page
      .locator(".space")
      .filter({ has: page.locator(".space-number", { hasText: "10" }) })
      .locator(".more-pawns"),
  ).toHaveText("+12");
  for (const size of [
    { width: 1024, height: 768 },
    { width: 1280, height: 800 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(size);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await expect(
      page.getByRole("button", { name: "Бросить кубик" }),
    ).toBeVisible();
  }
});
test("офлайн после кеширования, сохранение и отсутствие MP3", async ({
  page,
  context,
}) => {
  const errors: string[] = [];
  const external: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("request", (r) => {
    if (!r.url().startsWith("http://localhost:4173")) external.push(r.url());
  });
  await start(page);
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller)
      await new Promise<void>((resolve) =>
        navigator.serviceWorker.addEventListener(
          "controllerchange",
          () => resolve(),
          { once: true },
        ),
      );
  });
  await page
    .getByRole("button", { name: "Музыка и звук", exact: true })
    .click();
  await page.getByRole("switch").nth(0).check();
  await page.getByRole("button", { name: "Закрыть", exact: true }).click();
  await context.setOffline(true);
  await page.reload();
  await page.getByRole("button", { name: /Продолжить/ }).click();
  await expect(
    page.getByRole("button", { name: "Бросить кубик" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Бросить кубик" }).click();
  await expect(page.locator(".task-card")).toBeVisible();
  await page
    .locator(".task-card")
    .getByRole("button", { name: "✓ Засчитано" })
    .click();
  await expect(
    page.getByRole("button", { name: "Следующий игрок" }),
  ).toBeVisible();
  expect(errors).toEqual([]);
  expect(external).toEqual([]);
});
test("полная партия в браузере до победы", async ({ page }) => {
  await start(page);
  let won = false;
  for (let step = 0; step < 180; step++) {
    if (await page.locator(".victory").count()) {
      won = true;
      break;
    }
    const phase = await page.evaluate(
      () => JSON.parse(localStorage.getItem("gradus-save-v1")!).game.phase,
    );
    if (phase === "roll") {
      await page.getByRole("button", { name: "Бросить кубик" }).click();
      await expect(page.locator(".task-card")).toBeVisible();
    } else if (phase === "card" || phase === "final") {
      await page
        .locator(".task-card")
        .getByRole("button", { name: "✓ Засчитано" })
        .click();
      await expect(page.locator(".task-card")).not.toBeVisible();
    } else if (phase === "result") {
      await page
        .getByRole("button", { name: /Следующий игрок|Последний градус/ })
        .click();
      await expect
        .poll(() =>
          page.evaluate(
            () =>
              JSON.parse(localStorage.getItem("gradus-save-v1")!).game.phase,
          ),
        )
        .not.toBe("result");
    }
  }
  expect(won).toBe(true);
  await expect(page.locator(".winner")).toContainText(/Аня|Борис/);
  await page.getByRole("button", { name: "Отменить результат" }).click();
  await expect(page.locator(".final-card")).toBeVisible();
});
test("финал адресата подставы, провал на 27, победа", async ({ page }) => {
  const base = createGame(["Аня", "Борис"]);
  base.players[1].position = 28;
  const g = sabotage(
    roll(base, 1, () => 0),
    "p2",
  );
  await seed(page, g);
  await page
    .locator(".task-card")
    .getByRole("button", { name: "✓ Засчитано" })
    .click();
  await page
    .getByRole("button", { name: "Последний градус", exact: true })
    .click();
  await expect(page.locator(".task-player")).toContainText("Борис");
  await expect(
    page.getByRole("button", { name: /Подставить друга/ }),
  ).toHaveCount(0);
  await page
    .locator(".task-card")
    .getByRole("button", { name: "× Провал" })
    .click();
  await expect(page.locator(".result-text")).toContainText("27");
  await page.getByRole("button", { name: "Следующий игрок" }).click();
  await page.evaluate(() => {
    const s = JSON.parse(localStorage.getItem("gradus-save-v1")!);
    s.game.players[1].position = 29;
    localStorage.setItem("gradus-save-v1", JSON.stringify(s));
  });
  await page.reload();
  await page.getByRole("button", { name: /Продолжить/ }).click();
  await page.getByRole("button", { name: "Бросить кубик" }).click();
  await page
    .locator(".task-card")
    .getByRole("button", { name: "✓ Засчитано" })
    .click();
  await expect(page.locator(".winner")).toContainText("Борис");
});

test("округлое поле не перекрывается и помещается на планшетах", async ({
  page,
}) => {
  await start(page);
  for (const viewport of [
    { width: 1024, height: 768 },
    { width: 1280, height: 800 },
    { width: 1366, height: 768 },
  ]) {
    await page.setViewportSize(viewport);
    const geometry = await page.locator(".space").evaluateAll((nodes) =>
      nodes.map((node) => {
        const r = node.getBoundingClientRect();
        return {
          x: r.x + r.width / 2,
          y: r.y + r.height / 2,
          width: r.width,
          height: r.height,
          radius: getComputedStyle(node).borderRadius,
        };
      }),
    );
    expect(geometry).toHaveLength(30);
    for (const [i, a] of geometry.entries()) {
      expect(a.radius).toBe("50%");
      expect(Math.abs(a.width - a.height)).toBeLessThan(1);
      for (const b of geometry.slice(i + 1))
        expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThan(
          (a.width + b.width) / 2,
        );
    }
    const board = await page.locator(".board-shell").boundingBox();
    expect(board!.y + board!.height).toBeLessThan(viewport.height);
    const button = await page
      .getByRole("button", { name: "Бросить кубик" })
      .boundingBox();
    expect(button!.height).toBeGreaterThanOrEqual(48);
    expect(button!.y + button!.height).toBeLessThan(viewport.height);
  }
});

test("обычная анимация проводит фишку по дорожке и открывает карточку", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.addInitScript(() =>
    Object.defineProperty(crypto, "getRandomValues", {
      value: (values: Uint32Array) => {
        values.fill(5);
        return values;
      },
    }),
  );
  await start(page);
  await page.evaluate(() => {
    const frames: string[] = [];
    (window as unknown as { flightFrames: string[] }).flightFrames = frames;
    new MutationObserver((records) => {
      for (const record of records) {
        const el = record.target as Element;
        if (el.tagName === "g" && el.closest(".pawn-flight")) {
          const transform = el.getAttribute("transform");
          if (transform) frames.push(transform);
        }
      }
    }).observe(document.body, {
      attributes: true,
      subtree: true,
      attributeFilter: ["transform"],
    });
  });
  await page.getByRole("button", { name: "Бросить кубик" }).click();
  await expect(page.locator(".dice.rolling")).toBeVisible();
  await expect(page.locator(".task-card")).toBeVisible();
  await expect(page.locator(".pawn-flight g")).toHaveCount(0);
  const frames = await page.evaluate(
    () => (window as unknown as { flightFrames: string[] }).flightFrames,
  );
  expect(new Set(frames).size).toBeGreaterThan(5);
  await expect(
    page
      .locator(".space")
      .filter({ has: page.locator(".space-number", { hasText: "06" }) })
      .locator(".pawn"),
  ).toHaveText("1");
  await page
    .locator(".task-card")
    .getByRole("button", { name: "× Провал" })
    .click();
  await expect(page.locator(".feedback-failure")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Следующий игрок" }),
  ).toBeEnabled();
});
