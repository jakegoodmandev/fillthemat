import { spawnSync } from "node:child_process";

export function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

export function run(
  command: string,
  args: string[],
  env?: Record<string, string | undefined>,
) {
  const result = spawnSync(command, args, {
    stdio: "inherit",
    env: env ? { ...process.env, ...env } : process.env,
  });
  if (result.status !== 0) {
    fail(`${command} ${args.join(" ")} failed (${result.status ?? "spawn"})`);
  }
}

export function capture(command: string, args: string[]): string {
  const result = spawnSync(command, args, {
    encoding: "utf8",
    env: process.env,
  });
  if (result.status !== 0) {
    const stderr =
      result.stderr?.trim() || result.stdout?.trim() || "no output";
    fail(`${command} ${args.join(" ")} failed: ${stderr}`);
  }
  return result.stdout ?? "";
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
