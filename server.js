const crypto = require("node:crypto");
const fs = require("node:fs/promises");
const http = require("node:http");
const path = require("node:path");

const ROOT = __dirname;
const UPLOADS = path.join(ROOT, "uploads");
const DOCUMENT_PATH = path.join(UPLOADS, "liedzettel.pdf");
const LIBRARY_PATH = path.join(UPLOADS, "library.json");
const MAX_FILE_SIZE = 30 * 1024 * 1024;
const PORT = Number(process.env.PORT) || 4173;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

const MIME_TYPES = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".pdf": "application/pdf",
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

function readBody(request, limit) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    let tooLarge = false;

    request.on("data", (chunk) => {
      size += chunk.length;
      if (size > limit) {
        tooLarge = true;
        chunks.length = 0;
        return;
      }
      if (!tooLarge) chunks.push(chunk);
    });
    request.on("end", () => {
      if (tooLarge) {
        reject(Object.assign(new Error("Datei zu groß"), { status: 413 }));
      } else {
        resolve(Buffer.concat(chunks));
      }
    });
    request.on("error", reject);
  });
}

async function saveJsonAtomically(filePath, data) {
  const temporaryPath = `${filePath}.${process.pid}.tmp`;
  await fs.writeFile(temporaryPath, JSON.stringify(data, null, 2), "utf8");
  await fs.rename(temporaryPath, filePath);
}

async function handleApi(request, response, url) {
  if (url.pathname === "/api/library" && request.method === "GET") {
    try {
      const library = JSON.parse(await fs.readFile(LIBRARY_PATH, "utf8"));
      sendJson(response, 200, library);
    } catch (error) {
      sendJson(response, error.code === "ENOENT" ? 404 : 500, { error: "Liedzettel nicht gefunden." });
    }
    return;
  }

  if (url.pathname === "/api/library/document" && request.method === "PUT") {
    if (!requireAdmin(request, response)) return;
    if (!request.headers["content-type"]?.startsWith("application/pdf")) {
      sendJson(response, 415, { error: "Erwartet wird eine PDF-Datei." });
      return;
    }

    try {
      const contentLength = Number(request.headers["content-length"] || 0);
      if (contentLength > MAX_FILE_SIZE) {
        sendJson(response, 413, { error: "Die PDF-Datei darf höchstens 30 MB groß sein." });
        request.resume();
        return;
      }
      const pdf = await readBody(request, MAX_FILE_SIZE);
      if (pdf.length < 5 || pdf.subarray(0, 5).toString("ascii") !== "%PDF-") {
        sendJson(response, 400, { error: "Die ausgewählte Datei ist keine gültige PDF-Datei." });
        return;
      }
      await fs.mkdir(UPLOADS, { recursive: true });
      const temporaryPath = `${DOCUMENT_PATH}.${process.pid}.tmp`;
      await fs.writeFile(temporaryPath, pdf);
      await fs.rename(temporaryPath, DOCUMENT_PATH);
      sendJson(response, 200, { ok: true });
    } catch (error) {
      sendJson(response, error.status || 500, { error: error.status === 413 ? "Die PDF-Datei darf höchstens 30 MB groß sein." : "PDF-Upload fehlgeschlagen." });
    }
    return;
  }

  if (url.pathname === "/api/library" && request.method === "PUT") {
    if (!requireAdmin(request, response)) return;

    try {
      const body = await readBody(request, 1024 * 256);
      const input = JSON.parse(body.toString("utf8"));
      const hasDocument = await fs.stat(DOCUMENT_PATH).then(() => true, () => false);
      if (!hasDocument) {
        sendJson(response, 400, { error: "Bitte lade zuerst eine PDF-Datei hoch." });
        return;
      }
      if (typeof input.fileName !== "string" || !input.fileName.trim() || !Array.isArray(input.songs)) {
        sendJson(response, 400, { error: "Dateiname oder Liedliste fehlen." });
        return;
      }

      const songs = input.songs.map((song) => ({ title: String(song.title || "").trim(), page: Number(song.page) }));
      if (songs.some((song) => !song.title || !Number.isInteger(song.page) || song.page < 1)) {
        sendJson(response, 400, { error: "Jedes Lied benötigt einen Titel und eine gültige Seitenzahl." });
        return;
      }

      const library = {
        fileName: path.basename(input.fileName).slice(0, 120),
        pdfUrl: "/uploads/liedzettel.pdf",
        songs,
        updatedAt: new Date().toISOString(),
      };
      await fs.mkdir(UPLOADS, { recursive: true });
      await saveJsonAtomically(LIBRARY_PATH, library);
      sendJson(response, 200, library);
    } catch (error) {
      sendJson(response, error.status || 400, { error: "Liedliste konnte nicht gespeichert werden." });
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

  if ((decodedPath === "/admin.html" || decodedPath === "/admin.js") && !requireAdmin(request, response)) return;
  const relativePath = decodedPath === "/" ? "index.html" : decodedPath.replace(/^\/+/, "");
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