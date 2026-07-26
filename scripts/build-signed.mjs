import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

const signingKeyPath =
  process.env.INKMARK_SIGNING_KEY_PATH ??
  join(homedir(), ".tauri", "inkmark.key");
const signingKey = (await readFile(signingKeyPath, "utf8")).trim();

if (!signingKey) {
  throw new Error(`Updater signing key is empty: ${signingKeyPath}`);
}

const exitCode = await new Promise((resolve, reject) => {
  const child = spawn("pnpm", ["tauri:build"], {
    env: {
      ...process.env,
      TAURI_SIGNING_PRIVATE_KEY: signingKey,
      TAURI_SIGNING_PRIVATE_KEY_PASSWORD:
        process.env.TAURI_SIGNING_PRIVATE_KEY_PASSWORD ?? "",
    },
    stdio: "inherit",
  });

  child.once("error", reject);
  child.once("exit", (code) => {
    resolve(code ?? 1);
  });
});

if (exitCode !== 0) {
  throw new Error(`Signed build failed with exit code ${String(exitCode)}.`);
}
