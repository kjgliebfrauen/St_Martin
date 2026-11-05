const crypto = require("node:crypto");
const fs = require("node:fs/promises");
const http = require("node:http");
const path = require("node:path");

const ROOT = __dirname;
const TEXTS = path.join(ROOT, "texte");
const PORT = Number(process.env.PORT) || 4173;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const PUBLIC_FILES = new Set(["index.html", "impressum.html", "datenschutz.html", "admin.html", "app.js", "admin.js", "styles.css"]);

const MIME_TYPES = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
};

function sendJson(response, status, value) {
  response.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
  response.end(JSON.stringify(value));
}

function isAuthorized(request) {
  if (!ADMIN_PASSWORD) return false;
  const authorization = request.headers.authorization || "";
  const [scheme, encoded] = authorization.split(" ");
  if (scheme !== "Basic" || !encoded) return false;

  let credentials;
  try {
    credentials = Buffer.from(encoded, "base64").toString("utf8");
  } catch {
    return false;
  }
  if (!credentials.startsWith("admin:")) return false;

  const supplied = Buffer.from(credentials.slice("admin:".length));
  const expected = Buffer.from(ADMIN_PASSWORD);
  return supplied.length === expected.length && crypto.timingSafeEqual(supplied, expected);
}

function requireAdmin(request, response) {
  if (!ADMIN_PASSWORD) {
    sendJson(response, 503, { error: "Admin-Zugang ist nicht konfiguriert. Setze ADMIN_PASSWORD." });
    return false;
  }
  if (!isAuthorized(request)) {
    response.writeHead(401, { "WWW-Authenticate": 'Basic realm="St. Martinszug Verwaltung", charset="UTF-8"' });
    response.end("Anmeldung erforderlich.");
    return false;
  }
  return true;
}

async function handleApi(request, response, url) {
  if (url.pathname === "/api/songs" && request.method === "GET") {
    try {
      await fs.mkdir(TEXTS, { recursive: true });
      const entries = await fs.readdir(TEXTS, { withFileTypes: true });
      const files = entries
        .filter((entry) => entry.isFile() && path.extname(entry.name).toLowerCase() === ".txt")
        .sort((a, b) => a.name.localeCompare(b.name, "de"));
      const songs = (await Promise.all(files.map(async (file) => {
        const contents = await fs.readFile(path.join(TEXTS, file.name), "utf8");
        const lines = contents.replace(/^\uFEFF/, "").split(/\r?\n/);
        const titleLine = lines.findIndex((line) => line.trim());
        if (titleLine < 0) return null;
        const title = lines[titleLine].trim();
        const text = lines.slice(titleLine + 1).join("\n").trim();
        return text ? { title, text } : null;
      }))).filter(Boolean);
      sendJson(response, 200, { songs });
    } catch (error) {
      console.error("Liedtexte konnten nicht geladen werden:", error);
      sendJson(response, 500, { error: "Liedtexte konnten nicht geladen werden." });
    }
    return;
  }

  sendJson(response, 404, { error: "API-Endpunkt nicht gefunden." });
}

async function handleRequest(request, response) {
  const url = new URL(request.url, `http://${request.headers.host || "localhost"}`);

  if (url.pathname.startsWith("/api/")) {
    await handleApi(request, response, url);
    return;
  }

  let decodedPath;
  try {
    decodedPath = decodeURIComponent(url.pathname);
  } catch {
    response.writeHead(400).end("Ungültiger Pfad.");
    return;
  }

  const relativePath = decodedPath === "/" ? "index.html" : decodedPath.replace(/^\/+/, "");
  const isSongText = path.dirname(relativePath) === "texte" && path.extname(relativePath).toLowerCase() === ".txt";
  const isSongManifest = relativePath === "texte/songs.json";
  const isSongCatalog = relativePath === "texte/songs.js";
  if (!PUBLIC_FILES.has(relativePath) && !isSongText && !isSongManifest && !isSongCatalog) {
    response.writeHead(404).end("Datei nicht gefunden.");
    return;
  }
  if ((relativePath === "admin.html" || relativePath === "admin.js") && !requireAdmin(request, response)) return;
  const filePath = path.resolve(ROOT, relativePath);
  if (!filePath.startsWith(`${ROOT}${path.sep}`)) {
    response.writeHead(403).end("Zugriff verweigert.");
    return;
  }

  try {
    const data = await fs.readFile(filePath);
    const contentType = MIME_TYPES[path.extname(filePath)] || "application/octet-stream";
    response.writeHead(200, { "Content-Type": contentType, "Cache-Control": "no-cache" });
    response.end(request.method === "HEAD" ? undefined : data);
  } catch (error) {
    response.writeHead(error.code === "ENOENT" ? 404 : 500).end("Datei nicht gefunden.");
  }
}

const server = http.createServer((request, response) => {
  handleRequest(request, response).catch(() => {
    if (!response.headersSent) sendJson(response, 500, { error: "Interner Serverfehler." });
    else response.destroy();
  });
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`St. Martinszug Website: http://localhost:${PORT}`);
  console.log(ADMIN_PASSWORD ? "Admin-Zugang ist aktiviert." : "Admin-Zugang gesperrt: ADMIN_PASSWORD ist nicht gesetzt.");
});