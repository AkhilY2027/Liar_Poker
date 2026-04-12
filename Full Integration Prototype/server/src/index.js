const http = require("http");
const { Server } = require("socket.io");
const { registerSocketHandlers } = require("./socketServer");

const PORT = Number(process.env.PORT || 3000);

const server = http.createServer((req, res) => {
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
