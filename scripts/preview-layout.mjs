import { createServer } from "node:http";
import { readFile } from "node:fs/promises";

// Synthetic browser fixture only. No Assignr requests or private data.
const files = new Map([
  ["/", "tests/browser-layout.html"],
  ["/tests/browser-layout.js", "tests/browser-layout.js"],
  ["/extension/staffing.js", "extension/staffing.js"],
  ["/extension/overflow.js", "extension/overflow.js"],
  ["/extension/content.css", "extension/content.css"],
]);
const server = createServer(async (request, response) => {
  const file = files.get(new URL(request.url, "http://localhost").pathname);
  if (!file) { response.writeHead(404).end(); return; }
  try {
    const content = await readFile(new URL(`../${file}`, import.meta.url));
    const type = file.endsWith(".css") ? "text/css" : file.endsWith(".js") ? "text/javascript" : "text/html";
    response.writeHead(200, { "Content-Type": `${type}; charset=utf-8`, "Cache-Control": "no-store" });
    response.end(content);
  } catch { response.writeHead(500).end(); }
});
server.listen(0, "127.0.0.1", () => console.log(`Layout fixture: http://127.0.0.1:${server.address().port}/`));
