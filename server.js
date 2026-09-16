import { createServer } from "node:http";
import { readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = __dirname;
const port = Number(process.env.PORT || 5173);
const savePath = path.join(rootDir, "data", "save.local.json");
const defaultSavePath = path.join(rootDir, "data", "default-save.json");

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
};

function send(res, status, body, type = "text/plain; charset=utf-8") {
  res.writeHead(status, {
    "Content-Type": type,
    "Cache-Control": "no-store",
  });
  res.end(body);
}

async function readJsonFile(filePath) {
  const content = await readFile(filePath, "utf8");
  return JSON.parse(content);
}

async function readRequestBody(req) {
  const chunks = [];
  let total = 0;
  for await (const chunk of req) {
    total += chunk.length;
    if (total > 1024 * 1024) {
      throw new Error("Request body too large");
    }
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString("utf8");
}

async function handleApi(req, res, url) {
  if (url.pathname === "/api/save" && req.method === "GET") {
    const target = existsSync(savePath) ? savePath : defaultSavePath;
    const save = await readJsonFile(target);
    send(res, 200, JSON.stringify(save, null, 2), "application/json; charset=utf-8");
    return true;
  }

  if (url.pathname === "/api/save" && req.method === "POST") {
    const body = await readRequestBody(req);
    const payload = JSON.parse(body);
    const save = {
      ...payload,
      savedAt: new Date().toISOString(),
    };
    await writeFile(savePath, `${JSON.stringify(save, null, 2)}\n`, "utf8");
    send(res, 200, JSON.stringify({ ok: true, savedAt: save.savedAt }), "application/json; charset=utf-8");
    return true;
  }

  return false;
}

async function serveStatic(req, res, url) {
  const requestedPath = decodeURIComponent(url.pathname === "/" ? "/index.html" : url.pathname);
  const absolutePath = path.resolve(rootDir, `.${requestedPath}`);

  if (!absolutePath.startsWith(rootDir)) {
    send(res, 403, "Forbidden");
    return;
  }

  try {
    const ext = path.extname(absolutePath).toLowerCase();
    const file = await readFile(absolutePath);
    send(res, 200, file, mimeTypes[ext] || "application/octet-stream");
  } catch {
    send(res, 404, "Not found");
  }
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);

  try {
    if (await handleApi(req, res, url)) {
      return;
    }
    await serveStatic(req, res, url);
  } catch (error) {
    send(res, 500, JSON.stringify({ error: error.message }), "application/json; charset=utf-8");
  }
});

server.listen(port, () => {
  console.log(`God of Hanzi dev server running at http://localhost:${port}`);
});
