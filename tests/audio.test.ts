import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeAudio, defaults } from "../src/audio/settings";
import { Sound } from "../src/audio/audio";
class FakeAudio extends EventTarget {
  static instances: FakeAudio[] = [];
  volume = 1;
  paused = true;
  loop = false;
  preload = "";
  plays = 0;
  onended: (() => void) | null = null;
  onerror: (() => void) | null = null;
  constructor(public src: string) {
    super();
    FakeAudio.instances.push(this);
  }
  play() {
    this.plays++;
    this.paused = false;
    return Promise.resolve();
  }
  pause() {
    this.paused = true;
  }
  end() {
    this.paused = true;
    this.onended?.();
  }
}
function environment() {
  FakeAudio.instances = [];
  let count = 0;
  const frames = new Map<number, FrameRequestCallback>();
  Object.assign(globalThis, {
    Audio: FakeAudio,
    requestAnimationFrame: (cb: FrameRequestCallback) => {
      frames.set(++count, cb);
      return count;
    },
    cancelAnimationFrame: (id: number) => frames.delete(id),
  });
  return {
    flush() {
      const queued = [...frames.values()];
      frames.clear();
      queued.forEach((cb) => cb(performance.now() + 1000));
    },
    frames,
  };
}
test("legacy switches migrate and all three volume levels are clamped", () => {
  assert.deepEqual(
    normalizeAudio({ music: true, effects: false, voice: true, mute: true }),
    { ...defaults, music: true, effects: false, voice: true, mute: true },
  );
  const s = normalizeAudio({
    musicVolume: -1,
    effectsVolume: 8,
    voiceVolume: NaN,
    mute: "false",
  });
  assert.equal(s.musicVolume, 0);
  assert.equal(s.effectsVolume, 1);
  assert.equal(s.voiceVolume, defaults.voiceVolume);
  assert.equal(s.mute, false);
  assert.deepEqual(normalizeAudio(null), defaults);
});
test("missing assets make no requests and music never autoplays before a gesture", () => {
  const env = environment(),
    empty = new Sound([]);
  empty.theme("menu-theme");
  empty.unlock();
  empty.effect("chaos");
  assert.equal(FakeAudio.instances.length, 0);
  assert.equal(empty.rules(), false);
  assert.equal(empty.say("final"), false);
  const sound = new Sound(["menu-theme"]);
  sound.update({ ...defaults, music: true });
  sound.theme("menu-theme");
  assert.equal(FakeAudio.instances[0].plays, 0);
  sound.unlock();
  env.flush();
  assert.ok(FakeAudio.instances[0].plays > 0);
  assert.equal(FakeAudio.instances[0].volume, 0.35);
});
test("scene transition fades out old music and retains the new scene", () => {
  const env = environment(),
    sound = new Sound(["menu-theme", "game-theme"]);
  sound.update({ ...defaults, music: true, musicVolume: 0.6 });
  sound.theme("menu-theme");
  sound.unlock();
  env.flush();
  const old = FakeAudio.instances[0];
  assert.equal(old.volume, 0.6);
  sound.theme("game-theme");
  const game = FakeAudio.instances[1];
  assert.equal(game.volume, 0);
  assert.equal(old.paused, false);
  env.flush();
  assert.equal(old.paused, true);
  assert.equal(old.volume, 0);
  assert.equal(game.volume, 0.6);
  sound.update({ ...defaults, music: true, musicVolume: 0.8 });
  env.flush();
  assert.equal(game.volume, 0.8);
});
test("voice ducks music, does not queue chatter, restores the scene level and respects mute", async () => {
  const env = environment(),
    sound = new Sound([
      "game-theme",
      "rules-voice",
      "host-chaos",
      "host-final",
    ]);
  sound.update({
    ...defaults,
    music: true,
    musicVolume: 0.5,
    voiceVolume: 0.7,
  });
  sound.theme("game-theme", true);
  sound.unlock();
  env.flush();
  const music = FakeAudio.instances[0];
  assert.equal(music.volume, 0.21);
  assert.equal(sound.rules(), true);
  await Promise.resolve();
  env.flush();
  assert.ok(Math.abs(music.volume - 0.11) < 0.00001);
  assert.equal(FakeAudio.instances[1].volume, 0.7);
  assert.equal(sound.say("chaos"), false);
  FakeAudio.instances[1].end();
  env.flush();
  assert.equal(music.volume, 0.21);
  sound.say("final");
  await Promise.resolve();
  env.flush();
  const voice = FakeAudio.instances.at(-1)!;
  sound.update({ ...defaults, music: true, mute: true });
  env.flush();
  assert.equal(voice.paused, true);
  assert.equal(music.paused, true);
  assert.equal(music.volume, 0);
});
test("voice errors and tab hiding restore a usable music scene without uncaught errors", async () => {
  const env = environment(),
    sound = new Sound(["menu-theme", "rules-voice"]);
  sound.update({ ...defaults, music: true });
  sound.theme("menu-theme");
  sound.unlock();
  env.flush();
  sound.rules();
  await Promise.resolve();
  env.flush();
  const voice = FakeAudio.instances[1];
  voice.dispatchEvent(new Event("error"));
  voice.onerror?.();
  env.flush();
  assert.equal(FakeAudio.instances[0].volume, 0.35);
  assert.equal(sound.has("rules-voice"), false);
  sound.setHidden(true);
  assert.equal(FakeAudio.instances[0].paused, true);
  sound.setHidden(false);
  env.flush();
  assert.equal(FakeAudio.instances[0].paused, false);
});
