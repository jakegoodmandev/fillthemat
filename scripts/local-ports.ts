import {
  closeSync,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { createServer } from "node:net";
import { dirname, join, resolve } from "node:path";
import { tryCapture } from "./local-process";

export const APP_PORT_BASE = 3000;
export const APP_PORT_STRIDE = 10;
export const MAX_SLOT = 9;
export const SLOT_REGISTRY_NAME = "fillthemat-slots.json";

const LOCK_STALE_MS = 30_000;
const LOCK_RETRY_MS = 50;
const LOCK_ATTEMPTS = 50;

export type SlotClaim = {
  slot: number;
  appPort: number;
  reused: boolean;
};

export type SlotRegistry = {
  version: 1;
  slots: Record<string, { toplevel: string; appPort: number }>;
};

export function appPortForSlot(slot: number): number {
  return APP_PORT_BASE + slot * APP_PORT_STRIDE;
}

export function localSiteUrl(port: number): string {
  return `http://127.0.0.1:${port}`;
}

export function parsePort(value: string | undefined): number | undefined {
  if (!value || !/^\d+$/.test(value)) return undefined;
  const port = Number(value);
  if (port < 1 || port > 65535) return undefined;
  return port;
}

export function slotForAppPort(port: number): number | undefined {
  const delta = port - APP_PORT_BASE;
  if (delta < 0 || delta % APP_PORT_STRIDE !== 0) return undefined;
  const slot = delta / APP_PORT_STRIDE;
  if (!Number.isInteger(slot) || slot > MAX_SLOT) return undefined;
  return slot;
}

export function emptyRegistry(): SlotRegistry {
  return { version: 1, slots: {} };
}

export function parseSlotRegistry(text: string): SlotRegistry {
  const parsed: unknown = JSON.parse(text);
  if (
    typeof parsed !== "object" ||
    parsed === null ||
    (parsed as SlotRegistry).version !== 1 ||
    typeof (parsed as SlotRegistry).slots !== "object" ||
    (parsed as SlotRegistry).slots === null
  ) {
    throw new Error(`Invalid ${SLOT_REGISTRY_NAME}`);
  }
  return parsed as SlotRegistry;
}

export function isListenFree(
  port: number,
  host = "127.0.0.1",
): Promise<boolean> {
  return new Promise((resolveFree) => {
    const server = createServer();
    server.unref();
    server.once("error", () => resolveFree(false));
    server.listen(port, host, () => {
      server.close(() => resolveFree(true));
    });
  });
}

function git(args: string[]): string | undefined {
  const result = tryCapture("git", args);
  if (!result.ok) return undefined;
  const value = result.stdout.trim();
  return value || undefined;
}

function isPidAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

async function withSlotLock<T>(
  lockPath: string,
  fn: () => Promise<T>,
): Promise<T> {
  mkdirSync(dirname(lockPath), { recursive: true });
  for (let attempt = 0; attempt < LOCK_ATTEMPTS; attempt++) {
    try {
      const fd = openSync(lockPath, "wx");
      try {
        writeFileSync(fd, String(process.pid));
        return await fn();
      } finally {
        closeSync(fd);
        try {
          unlinkSync(lockPath);
        } catch {
          // ignore
        }
      }
    } catch (error) {
      const code =
        error && typeof error === "object" && "code" in error
          ? (error as { code?: string }).code
          : undefined;
      if (code !== "EEXIST") throw error;
      stealStaleLock(lockPath);
      await new Promise((r) => setTimeout(r, LOCK_RETRY_MS));
    }
  }
  throw new Error(
    `Could not lock ${lockPath}. Another bun run setup may be running.`,
  );
}

function stealStaleLock(lockPath: string) {
  if (!existsSync(lockPath)) return;
  try {
    const stat = statSync(lockPath);
    const pid = Number(readFileSync(lockPath, "utf8").trim());
    const staleAge = Date.now() - stat.mtimeMs > LOCK_STALE_MS;
    const dead = !Number.isFinite(pid) || !isPidAlive(pid);
    if (staleAge || dead) unlinkSync(lockPath);
  } catch {
    // raced with the holder
  }
}

function readRegistry(path: string): SlotRegistry {
  if (!existsSync(path)) return emptyRegistry();
  return parseSlotRegistry(readFileSync(path, "utf8"));
}

function writeRegistry(path: string, registry: SlotRegistry) {
  writeFileSync(path, `${JSON.stringify(registry, null, 2)}\n`);
}

function reapMissingWorktrees(registry: SlotRegistry) {
  for (const [slot, row] of Object.entries(registry.slots)) {
    if (!existsSync(row.toplevel)) delete registry.slots[slot];
  }
}

function rowForToplevel(
  registry: SlotRegistry,
  toplevel: string,
): { slot: number; appPort: number } | undefined {
  for (const [key, row] of Object.entries(registry.slots)) {
    if (row.toplevel === toplevel) {
      return { slot: Number(key), appPort: row.appPort };
    }
  }
  return undefined;
}

function slotOwner(registry: SlotRegistry, slot: number): string | undefined {
  return registry.slots[String(slot)]?.toplevel;
}

function portOwner(registry: SlotRegistry, port: number): string | undefined {
  for (const row of Object.values(registry.slots)) {
    if (row.appPort === port) return row.toplevel;
  }
  return undefined;
}

function takeSlot(
  registry: SlotRegistry,
  toplevel: string,
  slot: number,
  appPort: number,
) {
  for (const [key, row] of Object.entries(registry.slots)) {
    if (row.toplevel === toplevel) delete registry.slots[key];
  }
  registry.slots[String(slot)] = { toplevel, appPort };
}

export type ClaimAppSlotOptions = {
  toplevel: string;
  gitCommonDir: string;
  existingPort?: string;
  probe?: (port: number) => Promise<boolean>;
};

export async function claimAppSlot(
  options: ClaimAppSlotOptions,
): Promise<SlotClaim> {
  const probe = options.probe ?? isListenFree;
  const registryPath = join(options.gitCommonDir, SLOT_REGISTRY_NAME);
  const lockPath = `${registryPath}.lock`;

  return withSlotLock(lockPath, async () => {
    const registry = readRegistry(registryPath);
    reapMissingWorktrees(registry);

    const wantedPort = parsePort(options.existingPort);
    if (options.existingPort && wantedPort === undefined) {
      throw new Error(`Invalid PORT=${options.existingPort}`);
    }
    if (wantedPort !== undefined) {
      const slot = slotForAppPort(wantedPort);
      if (slot === undefined) {
        throw new Error(
          `PORT=${wantedPort} is not an eligible worktree port (use 3000, 3010, … 3090).`,
        );
      }
      const owner =
        slotOwner(registry, slot) ?? portOwner(registry, wantedPort);
      if (owner && owner !== options.toplevel) {
        throw new Error(
          `PORT=${wantedPort} is already claimed by ${owner}. Unset PORT or pick a free slot.`,
        );
      }
      takeSlot(registry, options.toplevel, slot, wantedPort);
      writeRegistry(registryPath, registry);
      return { slot, appPort: wantedPort, reused: true };
    }

    const existing = rowForToplevel(registry, options.toplevel);
    if (existing) {
      writeRegistry(registryPath, registry);
      return { slot: existing.slot, appPort: existing.appPort, reused: true };
    }

    for (let slot = 0; slot <= MAX_SLOT; slot++) {
      const owner = slotOwner(registry, slot);
      if (owner && owner !== options.toplevel) continue;
      const appPort = appPortForSlot(slot);
      const portTakenBy = portOwner(registry, appPort);
      if (portTakenBy && portTakenBy !== options.toplevel) continue;
      if (!(await probe(appPort))) continue;
      takeSlot(registry, options.toplevel, slot, appPort);
      writeRegistry(registryPath, registry);
      return { slot, appPort, reused: false };
    }

    throw new Error(
      `No free app port in ${APP_PORT_BASE}–${appPortForSlot(MAX_SLOT)} (slots 0–${MAX_SLOT}). Stop an extra bun run dev or remove a stale worktree.`,
    );
  });
}

export async function claimAppSlotForCwd(
  existingPort?: string,
): Promise<SlotClaim> {
  const toplevel = git(["rev-parse", "--show-toplevel"]);
  const gitCommonDirRaw = git(["rev-parse", "--git-common-dir"]);
  if (!toplevel || !gitCommonDirRaw) {
    const appPort = parsePort(existingPort) ?? APP_PORT_BASE;
    const slot = slotForAppPort(appPort);
    if (existingPort && slot === undefined) {
      throw new Error(
        `PORT=${existingPort} is not an eligible worktree port (use 3000, 3010, … 3090).`,
      );
    }
    return { slot: slot ?? 0, appPort, reused: Boolean(existingPort) };
  }

  return claimAppSlot({
    toplevel,
    gitCommonDir: resolve(gitCommonDirRaw),
    existingPort,
  });
}
