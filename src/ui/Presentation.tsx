import { useEffect, useRef, useState, type CSSProperties } from "react";
import type { Category } from "../game-engine/types";
import { sound } from "../audio/audio";
export function CategoryMark({ category }: { category: Category }) {
  return (
    <svg
      className={`category-mark mark-${category}`}
      viewBox="0 0 32 32"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {category === "voice" ? (
        <>
          <rect x="11" y="3" width="10" height="17" rx="5" />
          <path d="M7 14v2a9 9 0 0 0 18 0v-2M16 25v5m-5 0h10" />
          <g className="voice-wave">
            <path d="M3 11v8M29 11v8" />
          </g>
        </>
      ) : category === "body" ? (
        <>
          <path d="M4 23c7 0 5-14 12-14s4 13 12 10M23 13l5 6-7 3" />
          <path d="M5 9h4M3 14h4M7 28h5" opacity=".5" />
        </>
      ) : (
        <>
          <path d="m18 2-13 17h10l-1 11 13-18H17z" />
          <path d="m27 3-2 3M4 27l3-2" opacity=".5" />
        </>
      )}
    </svg>
  );
}
export function Intro({
  onEnd,
  onEnableSound,
}: {
  onEnd: () => void;
  onEnableSound: () => void;
}) {
  const [withSound, setWithSound] = useState(false);
  const endRef = useRef(onEnd);
  endRef.current = onEnd;
  useEffect(() => {
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const timer = setTimeout(() => endRef.current(), reduced ? 900 : 3800);
    return () => clearTimeout(timer);
  }, [withSound]);
  return (
    <div
      className={`splash cinematic-intro ${withSound ? "intro-audible" : ""}`}
      key={Number(withSound)}
      role="dialog"
      aria-modal="true"
      aria-label="ГРАДУС — вечер начинается"
    >
      <div className="intro-ring" aria-hidden="true" />
      <span className="eyebrow">Вечер начинается здесь</span>
      <div className="intro-word" aria-label="ГРАДУС">
        {"ГРАДУС".split("").map((letter, i) => (
          <span
            key={i}
            style={{ "--letter": i } as CSSProperties}
            aria-hidden="true"
          >
            {letter}
          </span>
        ))}
        <sup>°</sup>
      </div>
      <p className="intro-tagline">Хорошая компания. Высокий градус.</p>
      <div className="intro-progress" aria-hidden="true">
        <i />
      </div>
      <div className="intro-actions">
        <button
          className="secondary"
          onClick={() => {
            onEnableSound();
            sound.unlock();
            sound.effect("glass");
            setWithSound(true);
          }}
          disabled={withSound}
        >
          {withSound ? "Звук включён" : "Включить звук"}
        </button>
        <button className="text-button" onClick={onEnd}>
          Пропустить →
        </button>
      </div>
    </div>
  );
}
type FullscreenDocument = Document & {
  webkitFullscreenElement?: Element;
  webkitExitFullscreen?: () => Promise<void>;
};
type FullscreenElement = HTMLElement & {
  webkitRequestFullscreen?: () => Promise<void>;
};
export function FullscreenButton() {
  const [active, setActive] = useState(false),
    [notice, setNotice] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    const update = () =>
      setActive(
        !!(
          document.fullscreenElement ||
          (document as FullscreenDocument).webkitFullscreenElement
        ),
      );
    document.addEventListener("fullscreenchange", update);
    document.addEventListener("webkitfullscreenchange", update);
    return () => {
      document.removeEventListener("fullscreenchange", update);
      document.removeEventListener("webkitfullscreenchange", update);
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);
  const toggle = async () => {
    try {
      const doc = document as FullscreenDocument,
        element = document.documentElement as FullscreenElement;
      if (active) {
        if (doc.exitFullscreen) await doc.exitFullscreen();
        else await doc.webkitExitFullscreen?.();
      } else if (element.requestFullscreen) await element.requestFullscreen();
      else if (element.webkitRequestFullscreen)
        await element.webkitRequestFullscreen();
      else throw new Error("unsupported");
    } catch {
      setNotice(
        "На этом устройстве откройте игру с домашнего экрана для полного экрана.",
      );
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setNotice(""), 4500);
    }
  };
  return (
    <>
      <button
        className="icon-button fullscreen-button"
        aria-label={active ? "Выйти из полноэкранного режима" : "На весь экран"}
        onClick={() => void toggle()}
        title={active ? "Выйти из полноэкранного режима" : "На весь экран"}
      >
        <svg
          viewBox="0 0 24 24"
          width="21"
          height="21"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
          aria-hidden="true"
        >
          <path
            d={
              active
                ? "M9 3v6H3m12-6v6h6M9 21v-6H3m12 6v-6h6"
                : "M9 4H4v5m11-5h5v5M9 20H4v-5m11 5h5v-5"
            }
          />
        </svg>
      </button>
      {notice && (
        <div className="fullscreen-notice" role="status">
          {notice}
        </div>
      )}
    </>
  );
}
export function Moment({
  type,
}: {
  type: "success" | "failure" | "chaos" | "final";
}) {
  const text = {
    success: "ЗАСЧИТАНО!",
    failure: "НЕ ЗАСЧИТАНО!",
    chaos: "ХАОС!",
    final: "ПОСЛЕДНИЙ ГРАДУС",
  };
  return (
    <div className={`game-moment moment-${type}`} aria-hidden="true">
      <div className="moment-ring" />
      <span>
        {type === "success"
          ? "✦"
          : type === "failure"
            ? "×"
            : type === "chaos"
              ? "ϟ"
              : "°"}
      </span>
      <strong>{text[type]}</strong>
      <i />
    </div>
  );
}
