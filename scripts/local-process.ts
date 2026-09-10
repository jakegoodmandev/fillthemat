import { spawnSync } from "node:child_process";

export function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

export function tryCapture(
  command: string,
  args: string[],
): { ok: true; stdout: string } | { ok: false; stderr: string } {
  const result = spawnSync(command, args, {
    encoding: "utf8",
    env: process.env,
  });
  if (result.status !== 0) {
    return {
      ok: false,
      stderr: (result.stderr || result.stdout || "").trim() || "failed",
    };
  }
  return { ok: true, stdout: result.stdout ?? "" };
}
