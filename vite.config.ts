import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { readFileSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";
// Build the precache from actual emitted files, including any supplied audio.
export default defineConfig({
  define: {
    __AUDIO_FILES__: JSON.stringify(
      readdirSync("public/audio")
        .filter((f) => f.endsWith(".mp3"))
        .map((f) => f.slice(0, -4)),
    ),
  },
  plugins: [
    react(),
    {
      name: "offline-manifest",
      closeBundle() {
        const walk = (dir: string): string[] =>
          readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
            e.isDirectory() ? walk(`${dir}/${e.name}`) : [`${dir}/${e.name}`],
          );
        const files = walk("dist").filter((f) => !f.endsWith("/sw.js"));
        const revision = createHash("sha256")
          .update(
            files.map((f) => readFileSync(f)).join("") +
              readFileSync("public/sw.js", "utf8"),
          )
          .digest("hex")
          .slice(0, 12);
        const sw = readFileSync("public/sw.js", "utf8")
          .replace("__VERSION__", revision)
          .replace(
            "/*__PRECACHE__*/ []",
            JSON.stringify(files.map((f) => "./" + f.slice(5))),
          );
        return import("node:fs").then((fs) =>
          fs.writeFileSync("dist/sw.js", sw),
        );
      },
    },
  ],
});
