const http = require("http");
const fs = require("fs");
const path = require("path");
const { Server } = require("socket.io");
const { registerSocketHandlers } = require("./socketServer");

const PORT = Number(process.env.PORT || 3000);
const CARD_IMAGES_DIR = path.resolve(__dirname, "..", "..", "card_deck_images");

const server = http.createServer((req, res) => {
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

  res.writeHead(404, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ error: "Not found" }));
});

const io = new Server(server, {
  cors: {
    origin: "*",
  },
});

registerSocketHandlers(io);

server.listen(PORT, () => {
  console.info(`[server] running on http://localhost:${PORT}`);
});
