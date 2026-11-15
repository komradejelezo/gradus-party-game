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
import { trackPath, trackPoint } from "./board-layout";
import { CategoryMark, Intro, FullscreenButton, Moment } from "./Presentation";

type Screen = "menu" | "setup" | "onboarding" | "game";
type Dialog = "rules" | "audio" | "about" | "reset" | null;
const rulesVoice =
  "Добро пожаловать в ГРАДУС! Тут всё просто. Бросаешь кубик, двигаешь фишку и выполняешь задание. Справился — получаешь бонус. Облажался — ловишь штраф. Один раз за игру можешь подставить друга! Первым доберись до финиша и пройди последнее испытание. Ну что, готовы? Тогда погнали!";
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
      <p className="muted">Ваш вечер — ваша громкость.</p>
      {(
        [
          [
            "music",
            "Фоновая музыка",
            "Funky House · Nu Disco · Electro Swing",
            "musicVolume",
          ],
          [
            "effects",
            "Звуковые эффекты",
            "Кубик, шаги, карты и яркие моменты",
            "effectsVolume",
          ],
          [
            "voice",
            "Голос ведущего",
            "Правила и короткие реплики",
            "voiceVolume",
          ],
        ] as const
      ).map(([key, title, subtitle, volume]) => (
        <div className="audio-channel" key={key}>
          <label className="setting">
            <span>
              <b>{title}</b>
              <small>{subtitle}</small>
            </span>
            <input
              type="checkbox"
              role="switch"
              aria-label={title}
              checked={settings[key]}
              onChange={(e) =>
                setSettings({ ...settings, [key]: e.target.checked })
              }
            />
          </label>
          <label className="volume-control">
            <span>{Math.round(settings[volume] * 100)}%</span>
            <input
              type="range"
              min="0"
              max="100"
              step="1"
              aria-label={`Громкость: ${title.toLowerCase()}`}
              value={Math.round(settings[volume] * 100)}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  [volume]: Number(e.target.value) / 100,
                })
              }
            />
          </label>
        </div>
      ))}
      <label className="setting">
        <span>
          <b>Без звука</b>
          <small>Приглушить всё одним нажатием</small>
        </span>
        <input
          type="checkbox"
          role="switch"
          aria-label="Без звука"
          checked={settings.mute}
          onChange={(e) => setSettings({ ...settings, mute: e.target.checked })}
        />
      </label>
      <div className="audio-availability">
        <span className="live-dot" />
        <b>Оригинальные звуковые эффекты готовы</b>
      </div>
      {(!sound.hasMusic || !sound.hasHost) && (
        <p className="note">
          {!sound.hasMusic ? "Музыкальный саундтрек ещё не добавлен. " : ""}
          {!sound.hasHost ? "Записи ведущего ещё не добавлены. " : ""}Игра и
          звуковые эффекты работают без этих файлов.
        </p>
      )}
    </>
  );
}
function RulesAudio() {
  const [status, setStatus] = useState("");
  return (
    <>
      <button
        className="secondary"
        onClick={() => {
          sound.unlock();
          if (!sound.rules(() => setStatus("")))
            setStatus(
              "Запись правил ещё не добавлена. Все правила доступны в тексте.",
            );
          else setStatus("Слушаем правила… Нажмите ещё раз, чтобы повторить.");
        }}
      >
        <Icon name="play" /> Прослушать / повторить
      </button>
      {status && (
        <p className="voice-status" role="status">
          {status}
        </p>
      )}
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
        <div className="menu-utilities">
          <FullscreenButton />
          <span className="age">18+</span>
        </div>
      </header>
      <div className="menu-main">
        <section className="menu-copy">
          <Tag>
            <span className="live-dot" /> Вечер набирает обороты
          </Tag>
          <h1 className="menu-wordmark" aria-label="ГРАДУС">
            <span>ГРАДУС</span>
            <sup>°</sup>
          </h1>
          <h2 className="menu-tagline">
            Этот вечер
            <br />
            <em>будут вспоминать.</em>
          </h2>
          <p>
            Бросай кубик. Лови момент. Подставляй друзей.
            <br />
            Всё, что случится здесь, останется за столом.
          </p>
          <div className="menu-actions">
            <button className="primary" onClick={onStart}>
              Начать игру <Icon name="arrow" />
            </button>
            <button
              className="secondary"
              onClick={onContinue}
              disabled={!saved}
            >
              Продолжить{" "}
              <span className="muted">
                {saved ? `Ход ${saved.turn}` : "Нет сохранённой партии"}
              </span>
            </button>
          </div>
          <button
            className="text-button rules-link"
            onClick={() => onDialog("rules")}
          >
            <span className="circle-play">▷</span> Правила · две минуты — и
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
            <b>
              <CategoryMark category="chaos" />
            </b>
            <strong>
              ПЛАНОВ
              <br />
              БОЛЬШЕ НЕТ.
            </strong>
            <small>И это только начало</small>
          </div>
          <div className="art-card art-body">
            <span>02 / ТЕЛО</span>
            <b>
              <CategoryMark category="body" />
            </b>
            <strong>
              МЕНЬШЕ СЛОВ.
              <br />
              БОЛЬШЕ ДВИЖА.
            </strong>
          </div>
          <div className="art-card art-voice">
            <span>01 / ГОЛОС</span>
            <b>
              <CategoryMark category="voice" />
            </b>
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
function Pawn({
  player,
  index,
  active = false,
}: {
  player: Player;
  index: number;
  active?: boolean;
}) {
  return (
    <span
      className={`pawn ${active ? "is-active" : ""}`}
      title={player.name}
      style={
        {
          background: player.color,
          "--pawn-color": player.color,
        } as React.CSSProperties
      }
    >
      {index + 1}
    </span>
  );
}
function Board({ game }: { game: Game }) {
  const [positions, setPositions] = useState<Record<string, number>>(() =>
    Object.fromEntries(game.players.map((p) => [p.id, p.position])),
  );
  const [travelling, setTravelling] = useState(false);
  const moveKey = JSON.stringify([game.turn, game.phase, game.moves]);
  useEffect(() => {
    const finalPositions = Object.fromEntries(
      game.players.map((p) => [p.id, p.position]),
    );
    const steps = Math.max(
      0,
      ...game.moves.map((m) => Math.abs(m.to - m.from)),
    );
    if (matchMedia("(prefers-reduced-motion: reduce)").matches || !steps) {
      setPositions(finalPositions);
      setTravelling(false);
      return;
    }
    const initial = Object.fromEntries(
      game.players.map((p) => [
        p.id,
        game.moves.find((m) => m.player === p.id)?.from ?? p.position,
      ]),
    );
    setPositions(initial);
    setTravelling(true);
    let frame = 0;
    let lastStep = -1;
    const started = performance.now();
    const animate = (now: number) => {
      const progress = Math.min(steps, (now - started) / 90);
      const whole = Math.floor(progress),
        fraction = progress - whole;
      const eased = whole + fraction * fraction * (3 - 2 * fraction);
      if (whole !== lastStep && progress < steps) {
        sound.effect("step", whole);
        lastStep = whole;
      }
      setPositions(
        Object.fromEntries(
          game.players.map((p) => {
            const m = game.moves.find((m) => m.player === p.id);
            return [
              p.id,
              m
                ? m.from +
                  Math.sign(m.to - m.from) *
                    Math.min(eased, Math.abs(m.to - m.from))
                : p.position,
            ];
          }),
        ),
      );
      if (progress < steps) frame = requestAnimationFrame(animate);
      else {
        setPositions(finalPositions);
        setTravelling(false);
      }
    };
    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, [moveKey]);
  const movingIds = travelling
    ? game.moves.filter((m) => m.from !== m.to).map((m) => m.player)
    : [];
  const visiblePlayers = game.players
    .filter((p) => !movingIds.includes(p.id))
    .map((p) => ({ ...p, position: positions[p.id] ?? p.position }));
  return (
    <div className="board-shell">
      <div className="board-heading">
        <Tag>
          <span className="live-dot" /> Маршрут этого вечера
        </Tag>
        <span>
          СТАРТ <b>→</b> ЛЕГЕНДА
        </span>
      </div>
      <div className="board">
        <div className="board-sign" aria-hidden="true">
          <span>ГРАДУС°</span>
          <small>НАБИРАЕМ ОБОРОТЫ</small>
        </div>
        <svg className="board-path" viewBox="0 0 1000 700" aria-hidden="true">
          <defs>
            <linearGradient id="track-light" x1="0" y1="1" x2="1" y2="0">
              <stop stopColor="#FF4D6D" />
              <stop offset=".5" stopColor="#8B5CF6" />
              <stop offset="1" stopColor="#3EA6FF" />
            </linearGradient>
          </defs>
          <path className="track-shadow" d={trackPath} />
          <path className="track-bed" d={trackPath} />
          <path className="track-glow" d={trackPath} />
          <path className="track-line" d={trackPath} />
          <path className="track-trace" d={trackPath} pathLength="100" />
          <path
            className="track-progress"
            d={trackPath}
            pathLength="30"
            strokeDasharray={`${game.players[game.active].position} 30`}
          />
        </svg>
        <div
          className="track-start"
          style={{ left: "8.5%", top: `${590 / 7}%` }}
        >
          <span>↗</span>
          <b>СТАРТ</b>
          <small>0</small>
        </div>
        {board.map((category, i) => {
          const point = trackPoint(i + 1),
            occupants = visiblePlayers.filter((p) => p.position === i + 1);
          const allOccupants = game.players.filter(
            (p) => Math.round(positions[p.id] ?? p.position) === i + 1,
          );
          const activeHere = allOccupants.some(
            (p) => p.id === game.players[game.active].id,
          );
          return (
            <div
              key={i}
              className={`space ${category} ${i === 29 ? "finish" : ""} ${activeHere ? "occupied" : ""}`}
              style={
                {
                  left: `${point.x / 10}%`,
                  top: `${point.y / 7}%`,
                  "--cell-color": categories[category].color,
                } as React.CSSProperties
              }
              aria-label={`Клетка ${i + 1}, ${categories[category].name}${allOccupants.length ? ", игроки: " + allOccupants.map((p) => p.name).join(", ") : ""}`}
            >
              <span className="space-symbol">
                {i === 29 ? "⚑" : <CategoryMark category={category} />}
              </span>
              <span className="space-number">
                {String(i + 1).padStart(2, "0")}
              </span>
              {i === 29 && <span className="finish-label">ФИНИШ</span>}
              <div className="space-pawns">
                {occupants.slice(0, 3).map((p) => (
                  <Pawn
                    key={p.id}
                    player={p}
                    active={p.id === game.players[game.active].id}
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
        <svg className="pawn-flight" viewBox="0 0 1000 700" aria-hidden="true">
          {game.players
            .filter((p) => movingIds.includes(p.id))
            .map((p, i) => {
              const position = positions[p.id] ?? p.position;
              const point = trackPoint(position);
              const move = game.moves.find((m) => m.player === p.id)!;
              const hop =
                Math.sin(Math.PI * (position - Math.floor(position))) * 23;
              return (
                <g
                  key={p.id}
                  transform={`translate(${point.x} ${point.y - i * 12})`}
                >
                  {[0.11, 0.22, 0.33].map((lag, j) => {
                    const tail = trackPoint(
                      Math.max(
                        Math.min(move.from, move.to),
                        Math.min(
                          Math.max(move.from, move.to),
                          position - Math.sign(move.to - move.from) * lag,
                        ),
                      ),
                    );
                    return (
                      <circle
                        key={j}
                        cx={tail.x - point.x}
                        cy={tail.y - point.y}
                        r={15 - j * 3}
                        fill={p.color}
                        opacity={0.2 - j * 0.05}
                      />
                    );
                  })}
                  <ellipse
                    cy="22"
                    rx={17 - hop * 0.15}
                    ry="5"
                    fill="#08030e"
                    opacity={0.5 - hop * 0.008}
                  />
                  <g
                    className="jumping-token"
                    transform={`translate(0 ${-hop})`}
                  >
                    <circle className="pawn-aura" r="30" fill={p.color} />
                    <circle cy="4" r="21" fill="#0f081b" />
                    <circle
                      r="21"
                      fill={p.color}
                      stroke="#FFF3E0"
                      strokeWidth="2.5"
                    />
                    <ellipse
                      cy="-8"
                      rx="13"
                      ry="7"
                      fill="white"
                      opacity=".27"
                    />
                    <text
                      y="6"
                      textAnchor="middle"
                      fill="#1B0D2B"
                      fontSize="18"
                      fontWeight="800"
                    >
                      {game.players.indexOf(p) + 1}
                    </text>
                  </g>
                </g>
              );
            })}
        </svg>
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
                  key={p.id}
                  player={p}
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
  const dots: Record<number, number[]> = {
    1: [4],
    2: [0, 8],
    3: [0, 4, 8],
    4: [0, 2, 6, 8],
    5: [0, 2, 4, 6, 8],
    6: [0, 2, 3, 5, 6, 8],
  };
  return (
    <div className={`dice-stage ${rolling ? "is-rolling" : ""}`}>
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
        {[value || 5, 6, 3, 2, 4, 1].map((face, j) => (
          <div className={`dice-face face-${j}`} key={j} aria-hidden="true">
            {Array.from({ length: 9 }, (_, i) => (
              <i key={i} className={dots[face].includes(i) ? "dot" : ""} />
            ))}
          </div>
        ))}
      </div>
      <span className="dice-shadow" aria-hidden="true" />
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
  const [outcome, setOutcome] = useState<"success" | "failure" | null>(null);
  const pendingOutcome = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (pendingOutcome.current) clearTimeout(pendingOutcome.current);
    },
    [],
  );
  const choose = (success: boolean) => {
    if (pendingOutcome.current) return;
    setOutcome(success ? "success" : "failure");
    pendingOutcome.current = setTimeout(
      () => onResolve(success),
      matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 150,
    );
  };
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
      className={`task-card category-${card.category} ${isFinal ? "final-card" : ""} ${outcome ? `card-${outcome}` : ""}`}
      style={
        {
          "--task-accent": isFinal
            ? "#FFC107"
            : categories[card.category].color,
        } as React.CSSProperties
      }
      role="dialog"
      aria-modal="true"
      aria-labelledby="task-title"
    >
      {(isFinal || card.category === "chaos") && (
        <div
          className={`card-announcement ${isFinal ? "announcement-final" : ""}`}
          aria-hidden="true"
        >
          <span>{isFinal ? "°" : "ϟ"}</span>
          <strong>{isFinal ? "ПОСЛЕДНИЙ ГРАДУС" : "ХАОС!"}</strong>
        </div>
      )}
      <div className="card-watermark" aria-hidden="true">
        {isFinal ? "✶" : <CategoryMark category={card.category} />}
      </div>
      <div className="task-top">
        <span
          className="category-pill"
          style={{ color: categories[card.category].color }}
        >
          <CategoryMark category={card.category} />{" "}
          {isFinal ? "Финальное испытание" : categories[card.category].name}
        </span>
        <button
          className="task-undo"
          disabled={!canUndo || !!outcome}
          onClick={onUndo}
        >
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
        <button
          className="success"
          disabled={!!outcome}
          onClick={() => choose(true)}
        >
          ✓ Засчитано
        </button>
        <button
          className="failure"
          disabled={!!outcome}
          onClick={() => choose(false)}
        >
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
      <div className="victory-aura" aria-hidden="true">
        <i />
        <i />
        <i />
      </div>
      <div className="confetti" aria-hidden="true">
        {Array.from({ length: 48 }, (_, i) => (
          <i
            key={i}
            style={
              {
                left: `${(i * 37) % 100}%`,
                background: colors[i % colors.length],
                animationDelay: `${i * 0.025}s`,
                "--drift": `${(i % 2 ? 1 : -1) * (50 + i * 7)}px`,
                "--rest-top": `${(i * 31) % 100}%`,
                transform: `rotate(${i * 23}deg)`,
              } as React.CSSProperties
            }
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
          Реванш <Icon name="arrow" />
        </button>
        <button className="secondary" onClick={onMenu}>
          Главное меню
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
  const [feedback, setFeedback] = useState<"success" | "failure" | null>(null);
  const [moment, setMoment] = useState<"chaos" | "final" | null>(null);
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
  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  useEffect(() => {
    const unlock = () => sound.unlock();
    const tap = (event: Event) => {
      if ((event.target as Element).closest("button")) sound.effect("tap");
    };
    const visibility = () => sound.setHidden(document.hidden);
    document.addEventListener("pointerdown", unlock, { capture: true });
    document.addEventListener("keydown", unlock, { capture: true });
    document.addEventListener("click", tap, { capture: true });
    document.addEventListener("visibilitychange", visibility);
    return () => {
      document.removeEventListener("pointerdown", unlock, { capture: true });
      document.removeEventListener("keydown", unlock, { capture: true });
      document.removeEventListener("click", tap, { capture: true });
      document.removeEventListener("visibilitychange", visibility);
      sound.stopVoice();
    };
  }, []);

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
  useEffect(
    () => () => {
      if (screen === "onboarding" || dialog === "rules") sound.stopVoice();
    },
    [screen, dialog],
  );
  useEffect(() => {
    if (screen !== "game" || !game || moving) return;
    if (game.phase === "roll" && game.turn === 1 && !game.die)
      sound.say("start");
    if (game.phase === "won") {
      sound.effect("victory");
      sound.say("victory");
    } else if (game.phase === "final") {
      sound.effect("final");
      sound.say("final");
    } else if (game.phase === "card") {
      sound.effect(game.card?.category === "chaos" ? "chaos" : "card");
      if (game.card?.category === "chaos" && !game.recipient)
        sound.say("chaos");
    }
  }, [screen, game?.phase, game?.turn, moving]);
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
    sound.effect("dice");
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
          if (g.phase === "final") setMoment("final");
          else if (g.card?.category === "chaos") setMoment("chaos");
          timers.current.push(
            setTimeout(
              () => {
                setMoving(false);
                lock.current = false;
                setMoment(null);
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
    setFeedback(success ? "success" : "failure");
    timers.current.push(setTimeout(() => setFeedback(null), 750));
    const g = resolve(game, success);
    commit(g);
    if (g.phase !== "won") sound.effect(success ? "success" : "failure");
    if (success && (game.card?.effect.success ?? 0) >= 3) sound.say("bravo");
    else if (game.card?.resolution === "Дуэль")
      sound.say(success ? "success" : "failure");
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
      <div className="app-grain" aria-hidden="true">
        <div className="bar-shelves">
          {Array.from({ length: 12 }, (_, i) => (
            <i
              key={i}
              style={
                {
                  "--bottle": i,
                  "--bottle-width": `${15 + (i % 3) * 9}px`,
                  "--bottle-height": `${36 + (i % 4) * 10}px`,
                  "--bottle-bottom": `${(i % 2) * 60}%`,
                } as React.CSSProperties
              }
            />
          ))}
        </div>
        <div className="bar-light light-red" />
        <div className="bar-light light-blue" />
        <div className="bar-counter" />
        <div className="bar-dust">
          {Array.from({ length: 12 }, (_, i) => (
            <i
              key={i}
              style={
                {
                  "--particle": i,
                  "--particle-top": `${12 + ((i * 17) % 70)}%`,
                } as React.CSSProperties
              }
            />
          ))}
        </div>
      </div>
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
              <RulesAudio />
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
          <main
            className={`game page ${feedback ? `feedback-${feedback}` : ""}`}
          >
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
                <FullscreenButton />
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
                onSabotage={(id) => {
                  sound.effect("sabotage");
                  sound.say("sabotage");
                  commit(sabotage(game, id));
                }}
                onUndo={undo}
                canUndo={!!snapshot?.history.length}
              />
            )}
          </main>
        ))}
      {screen === "game" && (feedback || moment) && (
        <Moment type={feedback || moment!} />
      )}
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
          <RulesAudio />
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
          <p className="note">18+ · Версия 2.0 · Сделано для живой компании.</p>
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
        <Intro
          onEnd={endSplash}
          onEnableSound={() => {
            const next = { ...settings, mute: false, effects: true };
            sound.update(next);
            setSettings(next);
          }}
        />
      )}
    </>
  );
}
