import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import type { Game, Player } from "../game-engine/types";
import {
  createGame,
  roll,
  resolve,
  next,
  sabotage,
  dismissReminder,
} from "../game-engine/engine";
import { load, save, type Save } from "../game-engine/storage";
import { board, categories, colors } from "../content/board";
import { sound, type AudioSettings } from "../audio/audio";

type Screen = "menu" | "setup" | "onboarding" | "game";
type Dialog = "rules" | "audio" | "about" | "reset" | null;
const rulesVoice =
  "Добро пожаловать в ГРАДУС! Здесь всё просто. Бросаешь кубик, двигаешь фишку и выполняешь задание по цвету клетки. Справился — получаешь бонус. Облажался — ловишь штраф. Один раз за игру можешь подставить друга! Первым доберись до финиша и пройди последнее испытание. Ну что, готовы? Тогда погнали!";
function Icon({
  name,
}: {
  name: "arrow" | "sound" | "back" | "close" | "play" | "settings";
}) {
  const paths = {
    arrow: "M4 12h16m-6-6 6 6-6 6",
    sound: "M4 9v6h4l5 4V5L8 9H4m13-2q6 5 0 10",
    back: "M19 12H4m6-6-6 6 6 6",
    close: "m6 6 12 12M18 6 6 18",
    play: "m8 5 11 7-11 7Z",
    settings: "M4 7h16M4 17h16M8 4v6m8 4v6",
  };
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={paths[name]} />
    </svg>
  );
}
function Logo({ small = false }: { small?: boolean }) {
  return (
    <span className={small ? "logo small" : "logo"}>
      ГРАДУС<span className="degree">°</span>
    </span>
  );
}
function Modal({
  children,
  title,
  onClose,
  wide = false,
}: {
  children: ReactNode;
  title: string;
  onClose: () => void;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className={`dialog ${wide ? "wide" : ""}`}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
    >
      <div className="dialog-head">
        <h2>{title}</h2>
        <button className="icon-button" onClick={onClose} aria-label="Закрыть">
          <Icon name="close" />
        </button>
      </div>
      {children}
    </dialog>
  );
}
function Tag({ children }: { children: ReactNode }) {
  return <span className="eyebrow">{children}</span>;
}
function Rules() {
  return (
    <div className="rules">
      <p className="lead">
        Один экран. Вся компания.
        <br />
        Тридцать шагов до легенды.
      </p>
      <ol>
        <li>
          <b>Брось кубик.</b> Пройди от 1 до 6 клеток и открой задание по цвету.
        </li>
        <li>
          <b>Покажи класс.</b> Обычно успех даёт +1, провал −1. Дуэль: +2 или 0.
          Особые эффекты указаны на карточке. Бонус не открывает новое задание.
        </li>
        <li>
          <b>Подставь друга.</b> Один раз за партию передай обычную карточку. Он
          справился: ему +2, тебе −1. Провалился: тебе +1, ему −1. Повторная
          передача запрещена.
        </li>
        <li>
          <b>Забери финал.</b> Доберись до клетки 30 и пройди «Последний
          градус». Не вышло — возвращайся на 27. Передать финал нельзя.
        </li>
      </ol>
      <div className="note">
        Зачёт определяют игроки за столом. При голосовании нужно большинство;
        ничья — в пользу исполнителя. Таймер помогает, но не выносит вердикт.
        Любое задание можно пропустить кнопкой «Провал».
      </div>
      <p className="muted">
        18+ · Алкоголь не нужен. Уважайте личные границы. Достаточно хорошей
        компании.
      </p>
    </div>
  );
}
function AudioControls({
  settings,
  setSettings,
}: {
  settings: AudioSettings;
  setSettings: (s: AudioSettings) => void;
}) {
  return (
    <>
      <p className="muted">
        Ваш вечер — ваша громкость. Звук включается только после вашего
        действия.
      </p>
      {(
        [
          ["music", "Фоновая музыка", "Фанк, диско и немного свинга"],
          ["effects", "Звуковые эффекты", "Бросок, результат и яркие моменты"],
          ["voice", "Голос правил", "Заранее записанная озвучка"],
          ["mute", "Без звука", "Приглушить всё одним нажатием"],
        ] as const
      ).map(([key, title, sub]) => (
        <label className="setting" key={key}>
          <span>
            <b>{title}</b>
            <small>{sub}</small>
          </span>
          <input
            type="checkbox"
            role="switch"
            checked={settings[key]}
            onChange={(e) =>
              setSettings({ ...settings, [key]: e.target.checked })
            }
          />
        </label>
      ))}
      <p className="note">
        Музыка и голос доступны, если в сборку добавлены аудиофайлы. Без них
        игра работает в тишине; короткие сигналы создаются локально.
      </p>
    </>
  );
}
function Setup({
  onBack,
  onStart,
}: {
  onBack: () => void;
  onStart: (names: string[]) => void;
}) {
  const [names, setNames] = useState(["", ""]);
  const [error, setError] = useState("");
  const change = (i: number, value: string) =>
    setNames(names.map((n, j) => (j === i ? value : n)));
  const swap = (i: number, d: number) => {
    const ns = [...names];
    [ns[i], ns[i + d]] = [ns[i + d], ns[i]];
    setNames(ns);
  };
  return (
    <main className="setup page">
      <button className="text-button" onClick={onBack}>
        <Icon name="back" /> В меню
      </button>
      <div className="setup-heading">
        <div>
          <Tag>Собираем компанию</Tag>
          <h1>
            Кто сегодня
            <br />
            <em>в игре?</em>
          </h1>
        </div>
        <p className="muted">
          От 2 до 15 человек.
          <br />
          Порядок в списке — порядок ходов.
        </p>
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const final = names.map((n, i) => n.trim() || `Игрок ${i + 1}`);
          if (new Set(final).size !== final.length) {
            setError("Добавьте разные имена, чтобы не перепутать игроков.");
            return;
          }
          onStart(final);
        }}
      >
        <div className="player-inputs">
          {names.map((name, i) => (
            <div className="player-input" key={i}>
              <span className="token" style={{ background: colors[i] }}>
                {i + 1}
              </span>
              <input
                aria-label={`Имя игрока ${i + 1}`}
                maxLength={24}
                placeholder={`Игрок ${i + 1}`}
                value={name}
                onChange={(e) => change(i, e.target.value)}
              />
              <button
                type="button"
                className="order"
                disabled={i === 0}
                aria-label={`Переместить игрока ${i + 1} выше`}
                onClick={() => swap(i, -1)}
              >
                ↑
              </button>
              <button
                type="button"
                className="order"
                disabled={i === names.length - 1}
                aria-label={`Переместить игрока ${i + 1} ниже`}
                onClick={() => swap(i, 1)}
              >
                ↓
              </button>
              <button
                type="button"
                className="order"
                disabled={names.length <= 2}
                aria-label={`Удалить игрока ${i + 1}`}
                onClick={() => setNames(names.filter((_, j) => j !== i))}
              >
                ×
              </button>
            </div>
          ))}
        </div>
        <div className="setup-bottom">
          <button
            type="button"
            className="secondary"
            disabled={names.length >= 15}
            onClick={() => setNames([...names, ""])}
          >
            + Добавить игрока <span className="muted">{names.length}/15</span>
          </button>
          <button className="primary" type="submit">
            Все в сборе <Icon name="arrow" />
          </button>
        </div>
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
      </form>
    </main>
  );
}
function Menu({
  saved,
  onStart,
  onContinue,
  onDialog,
}: {
  saved: Game | null;
  onStart: () => void;
  onContinue: () => void;
  onDialog: (d: Dialog) => void;
}) {
  return (
    <main className="menu page">
      <header className="menu-header">
        <Logo small />
        <span className="edition">НАСТОЛЬНАЯ ИГРА ДЛЯ КОМПАНИИ</span>
        <span className="age">18+</span>
      </header>
      <div className="menu-main">
        <section className="menu-copy">
          <Tag>
            <span className="live-dot" /> Вечер набирает обороты
          </Tag>
          <h1>
            МЕНЬШЕ
            <br />
            ПРАВИЛ.
            <br />
            <span>БОЛЬШЕ</span>
            <br />
            <span className="outline">ГРАДУСА.</span>
          </h1>
          <p>
            Бросай кубик. Лови момент. Подставляй друзей.
            <br />
            Всё, что случится здесь, останется за столом.
          </p>
          <div className="menu-actions">
            <button className="primary" onClick={onStart}>
              Начать игру <Icon name="arrow" />
            </button>
            {saved && (
              <button className="secondary" onClick={onContinue}>
                Продолжить <span className="muted">Ход {saved.turn}</span>
              </button>
            )}
          </div>
          <button
            className="text-button rules-link"
            onClick={() => onDialog("rules")}
          >
            <span className="circle-play">▷</span> Как играть? Две минуты — и
            погнали
          </button>
        </section>
        <section
          className="menu-art"
          aria-label="Три категории игры: Голос, Тело и Хаос"
        >
          <div className="orbit orbit-one" />
          <div className="orbit orbit-two" />
          <div className="art-label">ХОРОШИЙ ВЕЧЕР НЕ СЛУЧАЕТСЯ САМ</div>
          <div className="art-card art-chaos">
            <span>03 / ХАОС</span>
            <b>✶</b>
            <strong>
              ПЛАНОВ
              <br />
              БОЛЬШЕ НЕТ.
            </strong>
            <small>И это только начало</small>
          </div>
          <div className="art-card art-body">
            <span>02 / ТЕЛО</span>
            <b>↝</b>
            <strong>
              МЕНЬШЕ СЛОВ.
              <br />
              БОЛЬШЕ ДВИЖА.
            </strong>
          </div>
          <div className="art-card art-voice">
            <span>01 / ГОЛОС</span>
            <b>◖</b>
            <strong>ТВОЙ ВЫХОД.</strong>
            <small>Скажи это красиво</small>
          </div>
          <div className="art-sticker">
            30
            <br />
            <span>КЛЕТОК ДО СЛАВЫ</span>
          </div>
          <div className="art-caption">
            <span className="live-dot" /> КАЖДЫЙ ХОД — НОВАЯ ИСТОРИЯ
          </div>
        </section>
      </div>
      <footer className="menu-footer">
        <div className="menu-facts">
          <span>
            2–15 <small>игроков</small>
          </span>
          <span>
            30 <small>клеток</small>
          </span>
          <span>
            1 <small>общий экран</small>
          </span>
        </div>
        <nav>
          <button className="text-button" onClick={() => onDialog("audio")}>
            <Icon name="sound" /> Музыка и звук
          </button>
          <button className="text-button" onClick={() => onDialog("about")}>
            Об игре →
          </button>
        </nav>
      </footer>
    </main>
  );
}
function Pawn({ player, index }: { player: Player; index: number }) {
  return (
    <span
      className="pawn"
      title={player.name}
      style={{ background: player.color }}
    >
      {index + 1}
    </span>
  );
}
function Board({ game }: { game: Game }) {
  const [positions, setPositions] = useState(() =>
    Object.fromEntries(game.players.map((p) => [p.id, p.position])),
  );
  const moveKey = JSON.stringify([game.turn, game.phase, game.moves]);
  useEffect(() => {
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const steps = Math.max(
      0,
      ...game.moves.map((m) => Math.abs(m.to - m.from)),
    );
    if (reduced || !steps) {
      setPositions(
        Object.fromEntries(game.players.map((p) => [p.id, p.position])),
      );
      return;
    }
    setPositions(
      Object.fromEntries(
        game.players.map((p) => [
          p.id,
          game.moves.find((m) => m.player === p.id)?.from ?? p.position,
        ]),
      ),
    );
    let step = 0;
    const timer = setInterval(() => {
      step++;
      setPositions(
        Object.fromEntries(
          game.players.map((p) => {
            const m = game.moves.find((m) => m.player === p.id);
            return [
              p.id,
              m
                ? m.from +
                  Math.sign(m.to - m.from) *
                    Math.min(step, Math.abs(m.to - m.from))
                : p.position,
            ];
          }),
        ),
      );
      if (step >= steps) clearInterval(timer);
    }, 85);
    return () => clearInterval(timer);
  }, [moveKey]);
  const visiblePlayers = game.players.map((p) => ({
    ...p,
    position: positions[p.id] ?? p.position,
  }));
  return (
    <div className="board-shell">
      <div className="board-heading">
        <Tag>Маршрут этого вечера</Tag>
        <span>
          СТАРТ <b>→</b> ЛЕГЕНДА
        </span>
      </div>
      <div className="board">
        <svg
          className="board-path"
          viewBox="0 0 600 500"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <path d="M50 50H550Q585 50 585 100T550 150H50Q15 150 15 200T50 250H550Q585 250 585 300T550 350H50Q15 350 15 400T50 450H550" />
        </svg>
        {board.map((category, i) => {
          const row = Math.floor(i / 6),
            col = row % 2 === 0 ? i % 6 : 5 - (i % 6);
          const occupants = visiblePlayers.filter((p) => p.position === i + 1);
          return (
            <div
              key={i}
              className={`space ${category} ${i === 29 ? "finish" : ""} ${occupants.some((p) => p.id === game.players[game.active].id) ? "occupied" : ""}`}
              style={
                {
                  gridColumn: col + 1,
                  gridRow: row + 1,
                  "--cell-color": categories[category].color,
                } as React.CSSProperties
              }
              aria-label={`Клетка ${i + 1}, ${categories[category].name}${occupants.length ? ", игроки: " + occupants.map((p) => p.name).join(", ") : ""}`}
            >
              <span className="space-number">
                {String(i + 1).padStart(2, "0")}
              </span>
              <span className="space-symbol">
                {i === 29 ? "⚑" : categories[category].symbol}
              </span>
              {i === 29 && <span className="finish-label">ФИНИШ</span>}
              <div className="space-pawns">
                {occupants.slice(0, 3).map((p) => (
                  <Pawn
                    key={p.id}
                    player={p}
                    index={game.players.findIndex(
                      (player) => player.id === p.id,
                    )}
                  />
                ))}
                {occupants.length > 3 && (
                  <span
                    className="more-pawns"
                    title={occupants
                      .slice(3)
                      .map((p) => p.name)
                      .join(", ")}
                  >
                    +{occupants.length - 3}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
      <div className="board-bottom">
        <div className="start">
          <span>СТАРТ · 0</span>
          <div>
            {visiblePlayers
              .filter((p) => p.position === 0)
              .slice(0, 5)
              .map((p) => (
                <Pawn
                  player={p}
                  key={p.id}
                  index={game.players.findIndex((player) => player.id === p.id)}
                />
              ))}
            {visiblePlayers.filter((p) => p.position === 0).length > 5 && (
              <span className="more-pawns">
                +{visiblePlayers.filter((p) => p.position === 0).length - 5}
              </span>
            )}
          </div>
        </div>
        <div className="legend">
          {Object.entries(categories).map(([id, c]) => (
            <span key={id}>
              <i style={{ background: c.color }} />
              {c.name}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
function Dice({ value, rolling }: { value: number | null; rolling: boolean }) {
  const positions: Record<number, number[]> = {
    1: [4],
    2: [0, 8],
    3: [0, 4, 8],
    4: [0, 2, 6, 8],
    5: [0, 2, 4, 6, 8],
    6: [0, 2, 3, 5, 6, 8],
  };
  return (
    <div
      className={`dice ${rolling ? "rolling" : ""}`}
      aria-label={
        rolling
          ? "Кубик вращается"
          : value
            ? `На кубике ${value}`
            : "Кубик готов"
      }
    >
      {Array.from({ length: 9 }, (_, i) => (
        <i key={i} className={positions[value || 5].includes(i) ? "dot" : ""} />
      ))}
    </div>
  );
}
function Task({
  game,
  onResolve,
  onSabotage,
  onUndo,
  canUndo,
}: {
  game: Game;
  onResolve: (s: boolean) => void;
  onSabotage: (id: string) => void;
  onUndo: () => void;
  canUndo: boolean;
}) {
  const taskDialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = taskDialog.current;
    d?.showModal();
    return () => d?.close();
  }, []);
  const card = game.card!;
  const isFinal = game.phase === "final";
  const active = game.players[game.active];
  const performer =
    game.players.find(
      (p) =>
        p.id ===
        (isFinal ? game.finalPlayer : game.recipient || game.randomTarget),
    ) || active;
  const [seconds, setSeconds] = useState(card.duration);
  const [running, setRunning] = useState(false);
  const [selecting, setSelecting] = useState(false);
  useEffect(() => {
    if (!running || seconds === 0) return;
    const t = setTimeout(() => setSeconds((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [running, seconds]);
  const e = card.effect;
  const num = (n: number) => (n > 0 ? `+${n}` : `${n}`);
  const effectText = isFinal
    ? "Зачёт — победа · Провал — на клетку 27"
    : game.recipient
      ? "Зачёт: исполнителю +2, инициатору −1. Провал: инициатору +1, исполнителю −1."
      : game.randomTarget
        ? `Зачёт: ${performer.name} ${num(e.targetSuccess || 0)}, ${active.name} ${num(e.success)}. Провал: ${performer.name} ${num(e.targetFailure || 0)}, ${active.name} ${num(e.failure)}.`
        : `Зачёт ${num(e.success)} · Провал ${num(e.failure)}`;
  return (
    <dialog
      ref={taskDialog}
      onCancel={(e) => e.preventDefault()}
      className={`task-card ${isFinal ? "final-card" : ""}`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="task-title"
    >
      <div className="task-top">
        <span
          className="category-pill"
          style={{ color: categories[card.category].color }}
        >
          {categories[card.category].symbol}{" "}
          {isFinal ? "Финальное испытание" : categories[card.category].name}
        </span>
        <button className="task-undo" disabled={!canUndo} onClick={onUndo}>
          ↶ Отменить
        </button>
      </div>
      <div className="task-player">
        <span style={{ background: performer.color }} />
        {performer.name}
        {game.recipient && <b>Личная подстава</b>}
        {game.randomTarget && !game.recipient && <b>Случайная подстава</b>}
      </div>
      <h2 id="task-title">{card.title}</h2>
      <p className="instruction">
        {game.recipient && card.transferInstruction
          ? card.transferInstruction
          : card.instruction}
      </p>
      <div className="task-meta">
        <span>{card.resolution}</span>
        <span>
          {game.recipient ? "Выбранный исполнитель" : card.participation}
        </span>
        <button
          className={`timer ${seconds === 0 ? "expired" : ""}`}
          onClick={() => {
            if (seconds === 0) {
              setSeconds(card.duration);
              setRunning(false);
            } else setRunning(!running);
          }}
          aria-label={
            seconds === 0
              ? "Повторить таймер"
              : running
                ? "Остановить таймер"
                : "Запустить таймер"
          }
        >
          {running && seconds > 0 ? "Ⅱ" : "▷"} {seconds} сек.
        </button>
      </div>
      <p className="effect-text">{effectText}</p>
      {seconds === 0 && (
        <p className="timer-hint" role="status">
          Время вышло. Решение всё равно за компанией.
        </p>
      )}
      <div className="outcomes">
        <button className="success" onClick={() => onResolve(true)}>
          ✓ Засчитано
        </button>
        <button className="failure" onClick={() => onResolve(false)}>
          × Провал
        </button>
      </div>
      {!isFinal && !game.recipient && active.sabotage && (
        <div className="sabotage-area">
          {!selecting ? (
            <button
              className="sabotage-button"
              onClick={() => setSelecting(true)}
            >
              → Подставить друга <span>1 жетон</span>
            </button>
          ) : (
            <>
              <div className="target-heading">
                <b>Кому передать задание?</b>
                <button onClick={() => setSelecting(false)}>Отмена</button>
              </div>
              <div className="target-list">
                {game.players
                  .filter((p) => p.id !== active.id)
                  .map((p) => (
                    <button key={p.id} onClick={() => onSabotage(p.id)}>
                      <span style={{ background: p.color }} />
                      {p.name}
                    </button>
                  ))}
              </div>
            </>
          )}
        </div>
      )}
      {isFinal && (
        <p className="task-footnote">
          Последний шаг к легенде. Передать это испытание нельзя.
        </p>
      )}
    </dialog>
  );
}
function Victory({
  game,
  onMenu,
  onNew,
  onUndo,
}: {
  game: Game;
  onMenu: () => void;
  onNew: () => void;
  onUndo: () => void;
}) {
  const p = game.players.find((p) => p.id === game.winner)!;
  return (
    <main className="victory page">
      <div className="confetti" aria-hidden="true">
        {Array.from({ length: 28 }, (_, i) => (
          <i
            key={i}
            style={{
              left: `${(i * 37) % 100}%`,
              background: colors[i % colors.length],
              animationDelay: `${-(i % 7)}s`,
              transform: `rotate(${i * 23}deg)`,
            }}
          />
        ))}
      </div>
      <Logo small />
      <Tag>Последний градус пройден</Tag>
      <div className="victory-mark">✶</div>
      <h1>
        ЭТО БЫЛО
        <br />
        <em>ЛЕГЕНДАРНО.</em>
      </h1>
      <div className="winner">
        <span className="token" style={{ background: p.color }}>
          {game.players.indexOf(p) + 1}
        </span>
        <strong>{p.name}</strong>
      </div>
      <p className="muted">
        30 клеток. Один победитель. Историй — на весь вечер.
      </p>
      <div className="victory-actions">
        <button className="primary" onClick={onNew}>
          Ещё по одной партии <Icon name="arrow" />
        </button>
        <button className="secondary" onClick={onMenu}>
          В главное меню
        </button>
      </div>
      <button className="text-button" onClick={onUndo}>
        ↶ Отменить результат
      </button>
    </main>
  );
}
export function App() {
  const [snapshot, setSnapshot] = useState<Save | null>(() => load());
  const [screen, setScreen] = useState<Screen>("menu");
  const [dialog, setDialog] = useState<Dialog>(null);
  const [splash, setSplash] = useState(() => {
    try {
      return !sessionStorage.getItem("gradus-intro");
    } catch {
      return true;
    }
  });
  const [settings, setSettings] = useState(sound.settings);
  const [draft, setDraft] = useState<string[]>([]);
  const [rolling, setRolling] = useState(false);
  const [moving, setMoving] = useState(false);
  const [storageError, setStorageError] = useState(false);
  const [offline, setOffline] = useState(!navigator.onLine);
  const lock = useRef(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const game = snapshot?.game ?? null;
  const endSplash = () => {
    setSplash(false);
    try {
      sessionStorage.setItem("gradus-intro", "1");
    } catch {}
  };
  useEffect(() => {
    const t = setTimeout(endSplash, 1600);
    return () => clearTimeout(t);
  }, []);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  useEffect(() => {
    const on = () => setOffline(!navigator.onLine);
    window.addEventListener("online", on);
    window.addEventListener("offline", on);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", on);
    };
  }, []);
  useEffect(() => {
    sound.update(settings);
  }, [settings]);
  useEffect(() => {
    if (snapshot) setStorageError(!save(snapshot));
  }, [snapshot]);
  useEffect(() => {
    const track =
      screen !== "game"
        ? "menu-theme"
        : game?.phase === "won"
          ? "victory"
          : game?.phase === "final"
            ? "final-theme"
            : "game-theme";
    sound.theme(track, game?.phase === "card" && screen === "game");
  }, [screen, game?.phase, settings]);
  useEffect(() => {
    if (screen !== "onboarding" && dialog !== "rules") sound.stopVoice();
  }, [screen, dialog]);
  const commit = (g: Game) =>
    setSnapshot((prev) =>
      prev
        ? { game: g, history: [...prev.history, prev.game].slice(-20) }
        : { game: g, history: [] },
    );
  const undo = () => {
    if (rolling || moving) return;
    setSnapshot((prev) =>
      prev && prev.history.length
        ? {
            game: prev.history[prev.history.length - 1],
            history: prev.history.slice(0, -1),
          }
        : prev,
    );
    sound.tick();
  };
  const startNew = () => {
    if (game && game.phase !== "won") setDialog("reset");
    else setScreen("setup");
  };
  const doRoll = () => {
    if (!game || lock.current || game.phase !== "roll") return;
    lock.current = true;
    setRolling(true);
    sound.tick();
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    timers.current.push(
      setTimeout(
        () => {
          const die = crypto.getRandomValues(new Uint32Array(1))[0]; // rejection sampling avoids modulo bias
          const max = 0x100000000 - (0x100000000 % 6);
          let random = die;
          while (random >= max)
            random = crypto.getRandomValues(new Uint32Array(1))[0];
          const g = roll(game, (random % 6) + 1);
          commit(g);
          setRolling(false);
          setMoving(true);
          sound.tick(true);
          timers.current.push(
            setTimeout(
              () => {
                setMoving(false);
                lock.current = false;
                if (g.card?.category === "chaos") sound.sting("chaos-sting");
              },
              reduced ? 30 : 650,
            ),
          );
        },
        reduced ? 30 : 650,
      ),
    );
  };
  const doResolve = (success: boolean) => {
    if (!game || lock.current) return;
    lock.current = true;
    const g = resolve(game, success);
    commit(g);
    sound.tick(success);
    setMoving(true);
    timers.current.push(
      setTimeout(
        () => {
          setMoving(false);
          lock.current = false;
        },
        matchMedia("(prefers-reduced-motion: reduce)").matches ? 30 : 650,
      ),
    );
  };
  return (
    <>
      <div className="app-grain" aria-hidden="true" />
      {screen === "menu" && (
        <Menu
          saved={game}
          onStart={startNew}
          onContinue={() => setScreen("game")}
          onDialog={setDialog}
        />
      )}
      {screen === "setup" && (
        <Setup
          onBack={() => setScreen("menu")}
          onStart={(names) => {
            setDraft(names);
            setScreen("onboarding");
          }}
        />
      )}
      {screen === "onboarding" && (
        <main className="onboarding page">
          <button className="text-button" onClick={() => setScreen("setup")}>
            <Icon name="back" /> К игрокам
          </button>
          <div className="onboarding-layout">
            <div>
              <Tag>Все за столом?</Tag>
              <h1>
                ПАРА ПРАВИЛ.
                <br />
                <em>И ПОГНАЛИ.</em>
              </h1>
              <p className="muted">
                {draft.length} игроков · один незабываемый вечер
              </p>
              <button className="secondary" onClick={() => sound.rules()}>
                <Icon name="play" /> Прослушать / повторить
              </button>
              <p className="voice-copy">{rulesVoice}</p>
            </div>
            <div>
              <Rules />
              <button
                className="primary full"
                onClick={() => {
                  sound.stopVoice();
                  setSnapshot({ game: createGame(draft), history: [] });
                  setScreen("game");
                }}
              >
                Начать · пропустить объяснение <Icon name="arrow" />
              </button>
            </div>
          </div>
        </main>
      )}
      {screen === "game" &&
        game &&
        (game.phase === "won" ? (
          <Victory
            game={game}
            onMenu={() => setScreen("menu")}
            onNew={() => setScreen("setup")}
            onUndo={undo}
          />
        ) : (
          <main className="game page">
            <header className="game-header">
              <button
                className="brand-button"
                onClick={() => setScreen("menu")}
                aria-label="В главное меню"
              >
                <Logo small />
              </button>
              <span className="turn-label">
                ХОД {String(game.turn).padStart(2, "0")}{" "}
                <span>· {game.players.length} ИГРОКОВ</span>
              </span>
              <div className="header-actions">
                <button
                  className="icon-button"
                  onClick={undo}
                  disabled={!snapshot?.history.length || rolling || moving}
                  aria-label="Отменить последнее действие"
                >
                  ↶
                </button>
                <button
                  className="icon-button"
                  onClick={() => setDialog("rules")}
                  aria-label="Правила"
                >
                  ?
                </button>
                <button
                  className="icon-button"
                  onClick={() => setDialog("audio")}
                  aria-label="Музыка и звук"
                >
                  <Icon name="sound" />
                </button>
              </div>
            </header>
            <div className="game-layout">
              <section className={`board-area ${moving ? "moving" : ""}`}>
                <Board game={game} />
                <div className="game-hint">
                  {moving
                    ? "Фишки в движении…"
                    : game.phase === "roll"
                      ? "Каждый ход — шанс стать легендой."
                      : game.result || "Задание ждёт своего героя."}
                </div>
                {game.reminders.length > 0 && (
                  <div className="reminders">
                    {game.reminders.map((r) => (
                      <div key={r.id}>
                        <b>{r.owner}: </b>
                        {r.text}
                        <small>{r.expires}</small>
                        <button
                          onClick={() => commit(dismissReminder(game, r.id))}
                          aria-label="Завершить временный эффект"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </section>
              <aside className="game-sidebar">
                <div className="current-player">
                  <Tag>Сейчас ходит</Tag>
                  <div className="current-name">
                    <span
                      className="token"
                      style={{ background: game.players[game.active].color }}
                    >
                      {game.active + 1}
                    </span>
                    <h1>{game.players[game.active].name}</h1>
                  </div>
                  <span className="position-label">
                    Клетка <b>{game.players[game.active].position}</b> / 30{" "}
                    <span>
                      ·{" "}
                      {game.players[game.active].sabotage
                        ? "→ Подстава есть"
                        : "Подстава потрачена"}
                    </span>
                  </span>
                </div>
                <div className="dice-panel">
                  <Dice value={game.die} rolling={rolling} />
                  {game.phase === "roll" ? (
                    <>
                      <p>{rolling ? "Судьба решает…" : "Ну что, рискнём?"}</p>
                      <button
                        className="primary full"
                        disabled={rolling || moving}
                        onClick={doRoll}
                      >
                        {rolling ? "Бросаем…" : "Бросить кубик"}{" "}
                        <Icon name="arrow" />
                      </button>
                    </>
                  ) : game.phase === "result" ? (
                    <>
                      <p className="result-text" role="status">
                        {game.result}
                      </p>
                      <button
                        className="primary full"
                        disabled={moving}
                        onClick={() => commit(next(game))}
                      >
                        {game.pendingFinal.length
                          ? "Последний градус"
                          : "Следующий игрок"}{" "}
                        <Icon name="arrow" />
                      </button>
                    </>
                  ) : (
                    <p>
                      {moving ? "Твой выход уже близко" : "Время испытания"}
                    </p>
                  )}
                </div>
                <div className="roster">
                  <div className="roster-heading">
                    <Tag>За этим столом</Tag>
                    <span>КЛЕТКА</span>
                  </div>
                  {game.players.map((p, i) => (
                    <div
                      className={`roster-player ${i === game.active ? "active" : ""}`}
                      key={p.id}
                    >
                      <Pawn player={p} index={i} />
                      <span>{p.name}</span>
                      <small
                        title={
                          p.sabotage
                            ? "Жетон подставы доступен"
                            : "Жетон потрачен"
                        }
                      >
                        {p.sabotage ? "→" : "—"}
                      </small>
                      <b>{p.position}</b>
                    </div>
                  ))}
                </div>
              </aside>
            </div>
            {(game.phase === "card" || game.phase === "final") && !moving && (
              <Task
                key={`${game.turn}-${game.card?.id}-${game.recipient}`}
                game={game}
                onResolve={doResolve}
                onSabotage={(id) => commit(sabotage(game, id))}
                onUndo={undo}
                canUndo={!!snapshot?.history.length}
              />
            )}
          </main>
        ))}
      <div className="connection-status" role="status">
        {storageError
          ? "Не удалось сохранить: хранилище браузера недоступно. Оставьте вкладку открытой."
          : offline
            ? "Вы офлайн · игра продолжается"
            : ""}
      </div>
      {dialog === "rules" && (
        <Modal
          title="Правила хорошего вечера"
          onClose={() => setDialog(null)}
          wide
        >
          <Rules />
          <button className="secondary" onClick={() => sound.rules()}>
            <Icon name="play" /> Озвучка · повторить
          </button>
        </Modal>
      )}
      {dialog === "audio" && (
        <Modal title="Музыка и звук" onClose={() => setDialog(null)}>
          <AudioControls settings={settings} setSettings={setSettings} />
        </Modal>
      )}
      {dialog === "about" && (
        <Modal title="Это ГРАДУС" onClose={() => setDialog(null)}>
          <p className="lead">
            Игра для тех,
            <br />
            кто собрался вместе.
          </p>
          <p>
            39 испытаний. Три категории. Один общий экран. От абсурдного тоста
            до танца плечами — у каждого будет свой звёздный выход.
          </p>
          <p className="muted">
            Всё хранится на этом устройстве. После первой загрузки готовой
            сборки игра доступна без интернета. Учётные записи не нужны.
          </p>
          <p className="note">18+ · Версия 1.0 · Сделано для живой компании.</p>
        </Modal>
      )}
      {dialog === "reset" && (
        <Modal title="Начать новый вечер?" onClose={() => setDialog(null)}>
          <p>
            Текущая партия будет заменена, когда вы нажмёте «Начать» после
            создания игроков.
          </p>
          <div className="dialog-actions">
            <button className="secondary" onClick={() => setDialog(null)}>
              Остаться
            </button>
            <button
              className="primary"
              onClick={() => {
                setDialog(null);
                setScreen("setup");
              }}
            >
              Новая партия <Icon name="arrow" />
            </button>
          </div>
        </Modal>
      )}
      {splash && (
        <div className="splash">
          <Tag>Вечер начинается здесь</Tag>
          <Logo />
          <span className="splash-line" />
          <button className="text-button" onClick={endSplash}>
            Пропустить →
          </button>
        </div>
      )}
    </>
  );
}
