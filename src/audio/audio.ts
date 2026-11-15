import { loadAudio, normalizeAudio, type AudioSettings } from "./settings";
export { defaults, loadAudio, type AudioSettings } from "./settings";
export type Cue =
  | "glass"
  | "tap"
  | "dice"
  | "step"
  | "card"
  | "success"
  | "failure"
  | "chaos"
  | "final"
  | "victory"
  | "sabotage";
export type HostCue =
  | "start"
  | "chaos"
  | "bravo"
  | "success"
  | "failure"
  | "sabotage"
  | "final"
  | "victory";
declare const __AUDIO_FILES__: string[];
const available = typeof __AUDIO_FILES__ === "undefined" ? [] : __AUDIO_FILES__;
const base = import.meta.env?.BASE_URL ?? "/";
// No soundtrack is synthesized here. Only short, original sound effects.
export class Sound {
  settings = loadAudio();
  private files: Set<string>;
  private failed = new Set<string>();
  private unlocked = false;
  private hidden = false;
  private context: AudioContext | null = null;
  private effectsBus: GainNode | null = null;
  private tracks = new Map<HTMLAudioElement, number>();
  private fades = new Map<HTMLAudioElement, number>();
  private music: HTMLAudioElement | null = null;
  private track = "";
  private duck = false;
  private voice: HTMLAudioElement | null = null;
  private transient = new Set<HTMLAudioElement>();
  private voiceDone: (() => void) | null = null;
  constructor(files = available) {
    this.files = new Set(files);
  }
  has(name: string) {
    return this.files.has(name) && !this.failed.has(name);
  }
  get hasMusic() {
    return ["menu-theme", "game-theme", "final-theme", "victory"].some((n) =>
      this.has(n),
    );
  }
  get hasHost() {
    return [
      "rules-voice",
      "host-start",
      "host-chaos",
      "host-bravo",
      "host-success",
      "host-failure",
      "host-sabotage",
      "host-final",
      "host-victory",
    ].some((n) => this.has(n));
  }
  update(settings: AudioSettings) {
    this.settings = normalizeAudio(settings);
    try {
      localStorage.setItem("gradus-audio", JSON.stringify(this.settings));
    } catch {}
    if (this.effectsBus)
      this.effectsBus.gain.value =
        this.settings.mute || !this.settings.effects
          ? 0
          : this.settings.effectsVolume;
    for (const element of this.transient)
      element.volume =
        this.settings.mute || !this.settings.effects
          ? 0
          : this.settings.effectsVolume * 0.55;
    if (
      this.settings.mute ||
      !this.settings.voice ||
      !this.settings.voiceVolume
    )
      this.stopVoice();
    else if (this.voice) this.voice.volume = this.settings.voiceVolume;
    if (
      this.settings.mute ||
      !this.settings.music ||
      !this.settings.musicVolume
    ) {
      for (const element of this.tracks.keys()) {
        this.cancelFade(element);
        element.pause();
        element.volume = 0;
      }
    } else this.refreshMusic();
  }
  // Called only from a user gesture. Rejected autoplay is intentionally silent.
  unlock() {
    this.unlocked = true;
    try {
      const Context =
        globalThis.AudioContext ??
        (globalThis as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (!this.context && Context) {
        this.context = new Context();
        this.effectsBus = this.context.createGain();
        this.effectsBus.connect(this.context.destination);
      }
      if (this.effectsBus)
        this.effectsBus.gain.value =
          this.settings.mute || !this.settings.effects
            ? 0
            : this.settings.effectsVolume;
      if (!this.hidden) void this.context?.resume().catch(() => {});
    } catch {}
    this.refreshMusic();
  }
  private asset(name: string) {
    const element = new Audio(`${base}audio/${name}.mp3`);
    element.preload = "auto";
    element.addEventListener("error", () => this.failed.add(name), {
      once: true,
    });
    return element;
  }
  private play(element: HTMLAudioElement) {
    if (!this.unlocked || this.hidden) return;
    void element.play().catch(() => {});
  }
  private musicLevel() {
    return (
      this.settings.musicVolume *
      (this.voice && !this.voice.paused ? 0.22 : this.duck ? 0.42 : 1)
    );
  }
  private cancelFade(element: HTMLAudioElement) {
    const id = this.fades.get(element);
    if (id !== undefined) cancelAnimationFrame(id);
    this.fades.delete(element);
  }
  private fade(element: HTMLAudioElement, to: number, remove = false) {
    this.cancelFade(element);
    const from = element.volume,
      started = performance.now();
    const animate = (now: number) => {
      const t = Math.min(1, (now - started) / 420);
      element.volume = Math.max(0, Math.min(1, from + (to - from) * t));
      if (t < 1) this.fades.set(element, requestAnimationFrame(animate));
      else {
        this.fades.delete(element);
        if (remove) {
          element.pause();
          this.tracks.delete(element);
        }
      }
    };
    this.fades.set(element, requestAnimationFrame(animate));
  }
  private refreshMusic() {
    if (
      !this.unlocked ||
      this.hidden ||
      this.settings.mute ||
      !this.settings.music ||
      !this.settings.musicVolume
    )
      return;
    if (this.music) {
      this.play(this.music);
      this.fade(this.music, this.musicLevel());
    }
  }
  theme(name: string, duck = false) {
    this.duck = duck;
    if (this.track !== name) {
      // At most one old and one new scene are kept for a short crossfade.
      for (const old of [...this.tracks.keys()]) {
        if (old !== this.music) {
          this.cancelFade(old);
          old.pause();
          this.tracks.delete(old);
        }
      }
      if (this.music) {
        if (this.unlocked && !this.hidden) this.fade(this.music, 0, true);
        else {
          this.music.pause();
          this.tracks.delete(this.music);
        }
      }
      this.track = name;
      this.music = this.has(name) ? this.asset(name) : null;
      if (this.music) {
        this.music.loop = true;
        this.music.volume = 0;
        this.tracks.set(this.music, 0);
      }
    }
    this.refreshMusic();
  }
  private speak(name: string, priority = false, onEnd?: () => void) {
    if (
      !this.unlocked ||
      this.hidden ||
      this.settings.mute ||
      !this.settings.voice ||
      !this.settings.voiceVolume ||
      !this.has(name)
    ) {
      onEnd?.();
      return false;
    }
    if (this.voice && !priority) return false;
    this.stopVoice();
    const element = this.asset(name);
    this.voice = element;
    this.voiceDone = onEnd ?? null;
    element.volume = this.settings.voiceVolume;
    const done = () => {
      if (this.voice !== element) return;
      this.voice = null;
      const callback = this.voiceDone;
      this.voiceDone = null;
      this.refreshMusic();
      callback?.();
    };
    element.onended = done;
    element.onerror = done;
    // Duck before playback starts and restore even after a playback rejection.
    if (this.music) this.fade(this.music, this.settings.musicVolume * 0.22);
    void element
      .play()
      .then(() => {
        if (this.voice === element) this.refreshMusic();
      })
      .catch(done);
    return true;
  }
  rules(onEnd?: () => void) {
    return this.speak("rules-voice", true, onEnd);
  }
  say(cue: HostCue) {
    return this.speak(`host-${cue}`, cue === "final" || cue === "victory");
  }
  stopVoice() {
    if (this.voice) {
      this.voice.onended = null;
      this.voice.onerror = null;
      this.voice.pause();
      this.voice = null;
    }
    const done = this.voiceDone;
    this.voiceDone = null;
    done?.();
    this.refreshMusic();
  }
  private localEffect(name: string) {
    const element = this.asset(name);
    element.volume = this.settings.effectsVolume * 0.55;
    this.transient.add(element);
    const done = () => this.transient.delete(element);
    element.onended = done;
    element.onerror = done;
    void element.play().catch(done);
  }
  effect(cue: Cue, variant = 0) {
    if (
      !this.unlocked ||
      this.hidden ||
      this.settings.mute ||
      !this.settings.effects ||
      !this.settings.effectsVolume
    )
      return;
    if (cue === "chaos" && this.has("chaos-sting")) {
      this.localEffect("chaos-sting");
      return;
    }
    const ctx = this.context,
      bus = this.effectsBus;
    if (!ctx || !bus) return;
    try {
      const note = (
        frequency: number,
        delay: number,
        duration: number,
        level: number,
        type: OscillatorType = "sine",
        end = frequency,
      ) => {
        const oscillator = ctx.createOscillator(),
          gain = ctx.createGain(),
          time = ctx.currentTime + delay;
        oscillator.type = type;
        oscillator.frequency.setValueAtTime(frequency, time);
        oscillator.frequency.exponentialRampToValueAtTime(
          Math.max(20, end),
          time + duration,
        );
        gain.gain.setValueAtTime(0, time);
        gain.gain.linearRampToValueAtTime(level, time + 0.006);
        gain.gain.exponentialRampToValueAtTime(0.0001, time + duration);
        oscillator.connect(gain);
        gain.connect(bus);
        oscillator.onended = () => {
          oscillator.disconnect();
          gain.disconnect();
        };
        oscillator.start(time);
        oscillator.stop(time + duration + 0.02);
      };
      switch (cue) {
        case "tap":
          note(720, 0, 0.055, 0.035, "sine", 480);
          break;
        case "glass":
          [1568, 2352, 3136, 4200].forEach((f, i) =>
            note(f, i * 0.012, 0.6 - i * 0.07, 0.045 / (i + 1)),
          );
          note(1800, 0.13, 0.45, 0.025);
          break;
        case "dice":
          [0, 0.07, 0.15, 0.25, 0.37, 0.51].forEach((t, i) => {
            note(170 + i * 35, t, 0.065, 0.07, "triangle", 90);
            note(1500 + i * 80, t, 0.035, 0.025);
          });
          break;
        case "step":
          note(350 + (variant % 6) * 45, 0, 0.075, 0.055, "sine", 250);
          note(95, 0, 0.055, 0.06, "triangle");
          break;
        case "card":
          note(500, 0, 0.13, 0.035, "triangle", 1300);
          note(1750, 0.08, 0.12, 0.025);
          break;
        case "success":
          [523.25, 659.25, 783.99, 1046.5].forEach((f, i) =>
            note(f, i * 0.045, 0.32, 0.045, "triangle"),
          );
          break;
        case "failure":
          note(320, 0, 0.22, 0.07, "triangle", 130);
          note(140, 0.17, 0.25, 0.055, "sine", 85);
          break;
        case "chaos":
          note(130, 0, 0.35, 0.06, "triangle", 260);
          [740, 554, 880].forEach((f, i) =>
            note(f, 0.07 + i * 0.085, 0.17, 0.035, "square", f * 0.94),
          );
          break;
        case "sabotage":
          note(420, 0, 0.13, 0.045, "triangle", 840);
          note(370, 0.13, 0.22, 0.04, "triangle", 185);
          break;
        case "final":
          [196, 293.66, 392].forEach((f, i) =>
            note(f, i * 0.12, 0.6, 0.04, "triangle"),
          );
          note(1568, 0.34, 0.45, 0.025);
          break;
        case "victory":
          [523, 659, 784, 1047, 784, 1047].forEach((f, i) =>
            note(f, i * 0.11, 0.45, 0.045, "triangle"),
          );
          break;
      }
    } catch {}
  }
  tick(high = false) {
    this.effect(high ? "card" : "tap");
  }
  setHidden(hidden: boolean) {
    this.hidden = hidden;
    if (hidden) {
      for (const element of this.tracks.keys()) {
        this.cancelFade(element);
        element.pause();
      }
      this.stopVoice();
      for (const e of this.transient) e.pause();
      this.transient.clear();
      void this.context?.suspend().catch(() => {});
    } else if (this.unlocked) {
      void this.context?.resume().catch(() => {});
      this.refreshMusic();
    }
  }
}
export const sound = new Sound();
