export type AudioSettings = {
  music: boolean;
  effects: boolean;
  voice: boolean;
  mute: boolean;
};
export const defaults: AudioSettings = {
  music: false,
  effects: true,
  voice: true,
  mute: false,
};
export function loadAudio(): AudioSettings {
  try {
    const raw = JSON.parse(localStorage.getItem("gradus-audio") || "{}");
    return Object.fromEntries(
      Object.entries(defaults).map(([k, v]) => [
        k,
        typeof raw[k] === "boolean" ? raw[k] : v,
      ]),
    ) as AudioSettings;
  } catch {
    return defaults;
  }
}
declare const __AUDIO_FILES__: string[];
const slots = [
  "menu-theme",
  "game-theme",
  "chaos-sting",
  "final-theme",
  "victory",
  "rules-voice",
];
class Sound {
  settings = loadAudio();
  music: HTMLAudioElement | null = null;
  voice: HTMLAudioElement | null = null;
  track = "";
  missing = new Set<string>(
    slots.filter((name) => !__AUDIO_FILES__.includes(name)),
  );
  context: AudioContext | null = null;
  update(settings: AudioSettings) {
    this.settings = settings;
    try {
      localStorage.setItem("gradus-audio", JSON.stringify(settings));
    } catch {}
    if (settings.mute || !settings.music) this.music?.pause();
    else if (this.music) this.play(this.music);
    if (settings.mute || !settings.voice) this.stopVoice();
  }
  private asset(name: string) {
    const a = new Audio(`${import.meta.env.BASE_URL}audio/${name}.mp3`);
    a.addEventListener("error", () => this.missing.add(name), { once: true });
    return a;
  }
  private play(a: HTMLAudioElement) {
    a.play().catch(() => {});
  }
  theme(name: string, duck = false) {
    if (this.track !== name) {
      this.music?.pause();
      this.music = this.missing.has(name) ? null : this.asset(name);
      this.track = name;
      if (this.music) this.music.loop = true;
    }
    if (this.music) {
      this.music.volume = duck ? 0.1 : 0.35;
      if (this.settings.music && !this.settings.mute) this.play(this.music);
    }
  }
  rules(onEnd?: () => void) {
    this.stopVoice();
    if (
      !this.settings.voice ||
      this.settings.mute ||
      this.missing.has("rules-voice")
    ) {
      onEnd?.();
      return;
    }
    this.voice = this.asset("rules-voice");
    if (this.music) this.music.volume = 0.08;
    const done = () => {
      if (this.music) this.music.volume = 0.35;
      onEnd?.();
    };
    this.voice.onended = done;
    this.voice.onerror = done;
    this.voice.play().catch(done);
  }
  stopVoice() {
    this.voice?.pause();
    this.voice = null;
    if (this.music) this.music.volume = 0.35;
  }
  sting(name: string) {
    if (!this.settings.effects || this.settings.mute || this.missing.has(name))
      return;
    const a = this.asset(name);
    a.volume = 0.45;
    this.play(a);
  }
  tick(high = false) {
    if (!this.settings.effects || this.settings.mute) return;
    try {
      this.context ??= new AudioContext();
      void this.context.resume();
      const o = this.context.createOscillator(),
        gain = this.context.createGain();
      o.type = "sine";
      o.frequency.value = high ? 660 : 260;
      gain.gain.setValueAtTime(0.05, this.context.currentTime);
      gain.gain.exponentialRampToValueAtTime(
        0.001,
        this.context.currentTime + 0.12,
      );
      o.connect(gain);
      gain.connect(this.context.destination);
      o.start();
      o.stop(this.context.currentTime + 0.12);
    } catch {}
  }
}
export const sound = new Sound();
