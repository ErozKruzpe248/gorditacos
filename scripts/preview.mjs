import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { resolve, extname, sep } from "node:path";
import { fileURLToPath } from "node:url";

const port = Number(process.env.GORDITACOS_PORT || 4173);
const base = fileURLToPath(new URL("../dist/", import.meta.url));
const mime = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".jpg": "image/jpeg", ".png": "image/png", ".webp": "image/webp" };
const server = createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, "http://localhost").pathname);
    const file = resolve(base, "." + (pathname === "/" ? "/index.html" : pathname));
    if (!file.startsWith(base.endsWith(sep) ? base : base + sep) || !mime[extname(file)]) throw new Error("Ruta desconocida");
    const bytes = await readFile(file);
    response.writeHead(200, { "Content-Type": mime[extname(file)], "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" });
    response.end(request.method === "HEAD" ? undefined : bytes);
  } catch {
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Archivo no encontrado.");
  }
});
server.listen(port, "127.0.0.1", () => console.log("Gorditacos en http://127.0.0.1:" + port + "/"));

