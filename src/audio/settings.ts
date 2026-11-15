export type AudioSettings = {
  music: boolean;
  effects: boolean;
  voice: boolean;
  mute: boolean;
  musicVolume: number;
  effectsVolume: number;
  voiceVolume: number;
};
export const defaults: AudioSettings = {
  music: false,
  effects: true,
  voice: true,
  mute: false,
  musicVolume: 0.35,
  effectsVolume: 0.65,
  voiceVolume: 0.9,
};
export function normalizeAudio(raw: unknown): AudioSettings {
  const source =
    raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  return Object.fromEntries(
    Object.entries(defaults).map(([key, fallback]) => {
      const value = source[key];
      return [
        key,
        typeof fallback === "boolean"
          ? typeof value === "boolean"
            ? value
            : fallback
          : typeof value === "number" && Number.isFinite(value)
            ? Math.max(0, Math.min(1, value))
            : fallback,
      ];
    }),
  ) as AudioSettings;
}
export function loadAudio(): AudioSettings {
  try {
    return normalizeAudio(
      JSON.parse(localStorage.getItem("gradus-audio") || "{}"),
    );
  } catch {
    return { ...defaults };
  }
}
