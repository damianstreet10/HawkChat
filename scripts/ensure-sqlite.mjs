/**
 * Rebuild better-sqlite3 when compiled for a different Node ABI than process.execPath.
 * npm on Windows uses Program Files Node; Cursor's `node` on PATH may differ.
 */
import { execFileSync } from "child_process";
import { existsSync } from "fs";
import { createRequire } from "module";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const require = createRequire(import.meta.url);

function npmCliPath() {
  const besideNode = path.join(
    path.dirname(process.execPath),
    "node_modules",
    "npm",
    "bin",
    "npm-cli.js",
  );
  if (existsSync(besideNode)) return besideNode;
  throw new Error(
    "npm CLI not found beside Node — install Node from nodejs.org and run npm install",
  );
}

/** node-gyp uses `node` from PATH; Cursor's bundled Node must not win over npm's Node. */
function pathForNativeBuild() {
  const nodeDir = path.dirname(process.execPath);
  const parts = (process.env.PATH ?? "")
    .split(path.delimiter)
    .filter(
      (p) =>
        p &&
        !/cursor/i.test(p) &&
        p.toLowerCase() !== nodeDir.toLowerCase(),
    );
  return [nodeDir, ...parts].join(path.delimiter);
}

function sqliteLoads() {
  try {
    const Database = require("better-sqlite3");
    const db = new Database(":memory:");
    db.close();
    return true;
  } catch {
    return false;
  }
}

if (!sqliteLoads()) {
  console.log(
    `[HawkChat] Rebuilding better-sqlite3 for Node ${process.version}…`,
  );
  execFileSync(process.execPath, [npmCliPath(), "rebuild", "better-sqlite3"], {
    cwd: root,
    stdio: "inherit",
    env: { ...process.env, PATH: pathForNativeBuild() },
  });
  if (!sqliteLoads()) {
    console.error(
      "[HawkChat] better-sqlite3 still fails to load. Use one Node version for npm and dev (see README).",
    );
    process.exit(1);
  }
}
