import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";

const root = join(process.cwd(), "dist");
const mime = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".png": "image/png", ".svg": "image/svg+xml", ".json": "application/json" };
createServer(async (req, res) => {
  try {
    const requested = normalize(decodeURIComponent((req.url || "/").split("?")[0])).replace(/^(\.\.[/\\])+/, "");
    let path = join(root, requested === "/" ? "index.html" : requested);
    let body;
    try { body = await readFile(path); } catch { path = join(root, "index.html"); body = await readFile(path); }
    res.writeHead(200, { "content-type": `${mime[extname(path)] || "application/octet-stream"}; charset=utf-8` }); res.end(body);
  } catch { res.writeHead(500); res.end("No se pudo abrir la compilacion"); }
}).listen(4175, "127.0.0.1", () => console.log("http://127.0.0.1:4175"));

