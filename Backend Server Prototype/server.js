const http = require("http");
const { Server } = require("socket.io");
const { registerGameSocketHandlers } = require("./src/socketHandlers");

const PORT = Number(process.env.PORT || 3000);

const httpServer = http.createServer((req, res) => {
  if (req.method === "GET" && req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true }));
    return;
  }

  res.writeHead(404, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ error: "Not found" }));
});

const io = new Server(httpServer, {
  cors: {
    origin: "*",
  },
});

registerGameSocketHandlers(io);

httpServer.listen(PORT, () => {
  console.info(`[server] Socket.IO server listening on port ${PORT}`);
});
