import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  appPortForSlot,
  claimAppSlot,
  localSiteUrl,
  parsePort,
  slotForAppPort,
} from "./local-ports";

function tempGitCommon(): string {
  const root = mkdtempSync(join(tmpdir(), "fillthemat-slots-"));
  const gitCommon = join(root, ".git");
  mkdirSync(gitCommon);
  return gitCommon;
}

describe("app port formula", () => {
  it("maps slots 0–9 onto 3000 + n*10", () => {
    expect(appPortForSlot(0)).toBe(3000);
    expect(appPortForSlot(2)).toBe(3020);
    expect(slotForAppPort(3010)).toBe(1);
    expect(slotForAppPort(3005)).toBeUndefined();
    expect(slotForAppPort(3100)).toBeUndefined();
    expect(localSiteUrl(3020)).toBe("http://127.0.0.1:3020");
    expect(parsePort("3010")).toBe(3010);
    expect(parsePort("nope")).toBeUndefined();
  });
});

describe("claimAppSlot", () => {
  it("assigns the lowest free slot and reuses it for the same worktree", async () => {
    const gitCommonDir = tempGitCommon();
    const toplevel = join(gitCommonDir, "..", "wt-a");
    mkdirSync(toplevel);

    const first = await claimAppSlot({
      toplevel,
      gitCommonDir,
      probe: async () => true,
    });
    expect(first).toMatchObject({ slot: 0, appPort: 3000, reused: false });

    const second = await claimAppSlot({
      toplevel,
      gitCommonDir,
      probe: async () => true,
    });
    expect(second).toMatchObject({ slot: 0, appPort: 3000, reused: true });
  });

  it("gives a second worktree the next port", async () => {
    const gitCommonDir = tempGitCommon();
    const a = join(gitCommonDir, "..", "wt-a");
    const b = join(gitCommonDir, "..", "wt-b");
    mkdirSync(a);
    mkdirSync(b);

    await claimAppSlot({ toplevel: a, gitCommonDir, probe: async () => true });
    const claimed = await claimAppSlot({
      toplevel: b,
      gitCommonDir,
      probe: async () => true,
    });
    expect(claimed).toMatchObject({ slot: 1, appPort: 3010, reused: false });
  });

  it("skips ports that fail the listen probe", async () => {
    const gitCommonDir = tempGitCommon();
    const toplevel = join(gitCommonDir, "..", "wt-a");
    mkdirSync(toplevel);
    const busy = new Set([3000, 3010]);

    const claimed = await claimAppSlot({
      toplevel,
      gitCommonDir,
      probe: async (port) => !busy.has(port),
    });
    expect(claimed).toMatchObject({ slot: 2, appPort: 3020 });
  });

  it("reaps a slot whose worktree directory is gone", async () => {
    const gitCommonDir = tempGitCommon();
    writeFileSync(
      join(gitCommonDir, "fillthemat-slots.json"),
      JSON.stringify({
        version: 1,
        slots: {
          "0": { toplevel: join(gitCommonDir, "..", "missing"), appPort: 3000 },
        },
      }),
    );
    const toplevel = join(gitCommonDir, "..", "wt-a");
    mkdirSync(toplevel);

    const claimed = await claimAppSlot({
      toplevel,
      gitCommonDir,
      probe: async () => true,
    });
    expect(claimed).toMatchObject({ slot: 0, appPort: 3000, reused: false });
  });

  it("keeps a hand-set eligible PORT", async () => {
    const gitCommonDir = tempGitCommon();
    const toplevel = join(gitCommonDir, "..", "wt-a");
    mkdirSync(toplevel);

    const claimed = await claimAppSlot({
      toplevel,
      gitCommonDir,
      existingPort: "3020",
      probe: async () => true,
    });
    expect(claimed).toMatchObject({ slot: 2, appPort: 3020, reused: true });
  });

  it("rejects a PORT already claimed by another worktree", async () => {
    const gitCommonDir = tempGitCommon();
    const a = join(gitCommonDir, "..", "wt-a");
    const b = join(gitCommonDir, "..", "wt-b");
    mkdirSync(a);
    mkdirSync(b);
    await claimAppSlot({
      toplevel: a,
      gitCommonDir,
      existingPort: "3010",
      probe: async () => true,
    });

    await expect(
      claimAppSlot({
        toplevel: b,
        gitCommonDir,
        existingPort: "3010",
        probe: async () => true,
      }),
    ).rejects.toThrow(/already claimed/);
  });
});
