import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { claimAppPort, localSiteUrl, portFromSiteUrl } from "./local-ports";

function tempGitCommon(): string {
  const root = mkdtempSync(join(tmpdir(), "fillthemat-ports-"));
  const gitCommon = join(root, ".git");
  mkdirSync(gitCommon);
  return gitCommon;
}

describe("local origin", () => {
  it("only accepts http://127.0.0.1:3000, 3010, … 3090", () => {
    expect(localSiteUrl(3020)).toBe("http://127.0.0.1:3020");
    expect(portFromSiteUrl("http://127.0.0.1:3010")).toBe(3010);
    expect(portFromSiteUrl("http://127.0.0.1:3005")).toBeUndefined();
    expect(portFromSiteUrl("http://127.0.0.1:3100")).toBeUndefined();
    expect(portFromSiteUrl("https://fillthemat.com")).toBeUndefined();
  });
});

describe("claimAppPort", () => {
  it("assigns the lowest free port and reuses it for the same worktree", async () => {
    const gitCommonDir = tempGitCommon();
    const toplevel = join(gitCommonDir, "..", "wt-a");
    mkdirSync(toplevel);

    const first = await claimAppPort({
      toplevel,
      gitCommonDir,
      probe: async () => true,
    });
    expect(first).toBe(3000);

    const second = await claimAppPort({
      toplevel,
      gitCommonDir,
      probe: async () => true,
    });
    expect(second).toBe(3000);
  });

  it("gives a second worktree the next port", async () => {
    const gitCommonDir = tempGitCommon();
    const a = join(gitCommonDir, "..", "wt-a");
    const b = join(gitCommonDir, "..", "wt-b");
    mkdirSync(a);
    mkdirSync(b);

    await claimAppPort({ toplevel: a, gitCommonDir, probe: async () => true });
    const claimed = await claimAppPort({
      toplevel: b,
      gitCommonDir,
      probe: async () => true,
    });
    expect(claimed).toBe(3010);
  });

  it("skips ports that fail the listen probe", async () => {
    const gitCommonDir = tempGitCommon();
    const toplevel = join(gitCommonDir, "..", "wt-a");
    mkdirSync(toplevel);
    const busy = new Set([3000, 3010]);

    const claimed = await claimAppPort({
      toplevel,
      gitCommonDir,
      probe: async (port) => !busy.has(port),
    });
    expect(claimed).toBe(3020);
  });

  it("reaps a port whose worktree directory is gone", async () => {
    const gitCommonDir = tempGitCommon();
    mkdirSync(join(gitCommonDir, "fillthemat-ports"));
    writeFileSync(
      join(gitCommonDir, "fillthemat-ports", "3000"),
      `${join(gitCommonDir, "..", "missing")}\n`,
    );
    const toplevel = join(gitCommonDir, "..", "wt-a");
    mkdirSync(toplevel);

    const claimed = await claimAppPort({
      toplevel,
      gitCommonDir,
      probe: async () => true,
    });
    expect(claimed).toBe(3000);
  });

  it("keeps a hand-set eligible SITE_URL", async () => {
    const gitCommonDir = tempGitCommon();
    const toplevel = join(gitCommonDir, "..", "wt-a");
    mkdirSync(toplevel);

    const claimed = await claimAppPort({
      toplevel,
      gitCommonDir,
      existingUrl: "http://127.0.0.1:3020",
      probe: async () => true,
    });
    expect(claimed).toBe(3020);
  });

  it("rejects a SITE_URL already claimed by another worktree", async () => {
    const gitCommonDir = tempGitCommon();
    const a = join(gitCommonDir, "..", "wt-a");
    const b = join(gitCommonDir, "..", "wt-b");
    mkdirSync(a);
    mkdirSync(b);
    await claimAppPort({
      toplevel: a,
      gitCommonDir,
      existingUrl: "http://127.0.0.1:3010",
      probe: async () => true,
    });

    await expect(
      claimAppPort({
        toplevel: b,
        gitCommonDir,
        existingUrl: "http://127.0.0.1:3010",
        probe: async () => true,
      }),
    ).rejects.toThrow(/already claimed/);
  });
});
