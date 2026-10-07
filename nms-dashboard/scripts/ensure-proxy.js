const http = require("http");
const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");

function checkProxyHealth() {
  return new Promise((resolve) => {
    const req = http.get("http://127.0.0.1:8000/health", (res) => {
      resolve(res.statusCode === 200);
    });
    req.on("error", () => resolve(false));
    req.setTimeout(1200, () => {
      req.destroy();
      resolve(false);
    });
  });
}

async function main() {
  const isHealthy = await checkProxyHealth();
  if (isHealthy) {
    console.log("\x1b[32m✔ [NMS Proxy] Backend proxy is already running on http://127.0.0.1:8000\x1b[0m");
    return;
  }

  console.log("\x1b[33m⚡ [NMS Proxy] Starting backend proxy in background on port 8000...\x1b[0m");
  const proxyDir = path.resolve(__dirname, "../../nms-proxy");
  const pythonCmd = fs.existsSync("C:\\Python311\\python.exe") ? "C:\\Python311\\python.exe" : "python";

  const child = spawn(
    pythonCmd,
    ["-m", "uvicorn", "app.main:app", "--host", "127.0.0.1", "--port", "8000"],
    {
      cwd: proxyDir,
      detached: true,
      stdio: "ignore",
      shell: false,
    }
  );
  child.unref();

  // Poll for up to 6 seconds until ready
  const start = Date.now();
  while (Date.now() - start < 6000) {
    await new Promise((r) => setTimeout(r, 600));
    const ok = await checkProxyHealth();
    if (ok) {
      console.log("\x1b[32m✔ [NMS Proxy] Backend proxy successfully started on http://127.0.0.1:8000\x1b[0m");
      return;
    }
  }

  console.log("\x1b[33m⚠ [NMS Proxy] Backend proxy launched. Proceeding with dashboard...\x1b[0m");
}

main().catch((err) => {
  console.warn("[NMS Proxy] Note:", err);
});
