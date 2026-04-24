const http = require("http");
const fs = require("fs");
const path = require("path");
const { Server } = require("socket.io");
const { registerSocketHandlers } = require("./socketServer");

const HOST = process.env.HOST || "0.0.0.0";
const PORT = Number(process.env.PORT || 3000);
const CARD_IMAGES_DIR = path.resolve(__dirname, "..", "..", "card_deck_images");
const CLIENT_DIST_DIR = path.resolve(__dirname, "..", "..", "client", "dist");

function contentTypeFor(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".html") return "text/html; charset=utf-8";
  if (ext === ".js") return "application/javascript; charset=utf-8";
  if (ext === ".css") return "text/css; charset=utf-8";
  if (ext === ".png") return "image/png";
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".svg") return "image/svg+xml";
  if (ext === ".ico") return "image/x-icon";
  if (ext === ".woff") return "font/woff";
  if (ext === ".woff2") return "font/woff2";
  return "application/octet-stream";
}

function serveFile(res, filePath) {
  if (!fs.existsSync(filePath)) {
    return false;
  }

  res.writeHead(200, { "Content-Type": contentTypeFor(filePath) });
  fs.createReadStream(filePath).pipe(res);
  return true;
}

const server = http.createServer((req, res) => {
  if (req.url && req.url.startsWith("/socket.io/")) {
    // Allow Socket.IO's own request listener to handle handshake/polling routes.
    return;
  }

  if (req.url && req.url.startsWith("/card_deck_images/")) {
    const fileName = path.basename(req.url);
    const filePath = path.join(CARD_IMAGES_DIR, fileName);
    if (!fs.existsSync(filePath)) {
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Card image not found" }));
      return;
    }

    res.writeHead(200, { "Content-Type": "image/png" });
    fs.createReadStream(filePath).pipe(res);
    return;
  }

  if (req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true }));
    return;
  }

  // Render deployment: serve built React app and assets from client/dist.
  if ((req.method === "GET" || req.method === "HEAD") && fs.existsSync(CLIENT_DIST_DIR)) {
    const rawPath = (req.url || "/").split("?")[0];
    const safePath = decodeURIComponent(rawPath);
    const normalizedPath = safePath === "/" ? "/index.html" : safePath;
    const candidatePath = path.resolve(CLIENT_DIST_DIR, `.${normalizedPath}`);

    if (candidatePath.startsWith(CLIENT_DIST_DIR) && fs.existsSync(candidatePath) && fs.statSync(candidatePath).isFile()) {
      serveFile(res, candidatePath);
      return;
    }

    const indexPath = path.join(CLIENT_DIST_DIR, "index.html");
    if (serveFile(res, indexPath)) {
      return;
    }
  }

  res.writeHead(404, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ error: "Not found" }));
});

const io = new Server(server, {
  cors: {
    origin: "*",
  },
});

registerSocketHandlers(io);

server.listen(PORT, HOST, () => {
  console.info(`[server] running on ${HOST}:${PORT}`);
});
