import { execSync, spawn } from "child_process";
import { existsSync, rmSync, statSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const fresh = process.argv.includes("--fresh");
const lan = process.argv.includes("--lan");
const PORT = process.env.PORT ?? "3000";

/** Stop stale Next dev servers so we stay on PORT (LAN URL expects 3000). */
function freeDevPorts() {
  if (process.platform !== "win32") return;
  for (const port of [PORT, "3001"]) {
    try {
      execSync(
        `powershell -NoProfile -Command "Get-NetTCPConnection -LocalPort ${port} -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique | ForEach-Object { Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue }"`,
        { stdio: "ignore" },
      );
    } catch {
      /* port already free */
    }
  }
}

await import("./ensure-sqlite.mjs");
freeDevPorts();

const dbPath = path.join(root, "data", "hawkchat.db");
if (existsSync(dbPath) && statSync(dbPath).size === 0) {
  rmSync(dbPath);
  console.log("[HawkChat] Removed empty data/hawkchat.db — will recreate on first request.");
}

if (fresh) {
  rmSync(path.join(root, ".next"), { recursive: true, force: true });
}

const nextArgs = ["dev", "-p", PORT];
if (lan) nextArgs.push("-H", "0.0.0.0");

const child = spawn(
  process.execPath,
  [path.join(root, "node_modules", "next", "dist", "bin", "next"), ...nextArgs],
  { cwd: root, stdio: "inherit", env: process.env },
);

child.on("exit", (code) => process.exit(code ?? 0));
