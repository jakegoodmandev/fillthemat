import { lstatSync, realpathSync } from "node:fs";
import { dirname, join } from "node:path";
import type { NextConfig } from "next";

/**
 * Worktrees share the main checkout's `node_modules` via a symlink. Turbopack
 * treats that as resolving outside the project root and refuses to build, so
 * point the filesystem root at the directory that actually contains the linked
 * dependencies. In a normal checkout (node_modules is a real directory) this is
 * identical to the project root, so nothing changes there.
 */
function findTurbopackRoot(projectDir: string): string {
  const nodeModules = join(projectDir, "node_modules");
  try {
    if (lstatSync(nodeModules).isSymbolicLink()) {
      return dirname(realpathSync(nodeModules));
    }
  } catch {
    // Fall through to the project directory.
  }
  return projectDir;
}

const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1", "localhost"],
  turbopack: {
    root: findTurbopackRoot(process.cwd()),
  },
};

export default nextConfig;
