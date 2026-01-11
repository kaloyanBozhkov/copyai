import http from "http";
import fs from "fs";
import path from "path";
import os from "os";
import { exec } from "child_process";
import { transferPageHtml } from "./html";

const PORT = 8765;

export const getLocalIP = () => {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name] ?? []) {
      if (iface.family === "IPv4" && !iface.internal) {
        return iface.address;
      }
    }
  }
  return "localhost";
};

export const startTransferServer = async (): Promise<string> => {
  const transferPath = path.join(os.homedir(), "Downloads", "transfers");
  if (!fs.existsSync(transferPath)) {
    fs.mkdirSync(transferPath, { recursive: true });
  }

  const localIP = getLocalIP();

  const server = http.createServer((req, res) => {
    if (req.method === "GET" && req.url === "/") {
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end(transferPageHtml);
      return;
    }

    if (req.method === "POST" && req.url === "/upload") {
      const boundary = req.headers["content-type"]?.split("boundary=")[1];
      if (!boundary) {
        res.writeHead(400);
        res.end("No boundary");
        return;
      }

      const chunks: Buffer[] = [];
      req.on("data", (chunk) => chunks.push(chunk));
      req.on("end", () => {
        const buffer = Buffer.concat(chunks);
        const parts = buffer
          .toString("binary")
          .split("--" + boundary)
          .filter((p) => p.includes("filename="));

        let savedCount = 0;
        for (const part of parts) {
          const filenameMatch = part.match(/filename="([^"]+)"/);
          if (!filenameMatch) continue;

          const filename = filenameMatch[1];
          const headerEnd = part.indexOf("\r\n\r\n");
          if (headerEnd === -1) continue;

          let content = part.slice(headerEnd + 4);
          if (content.endsWith("\r\n--")) {
            content = content.slice(0, -4);
          } else if (content.endsWith("\r\n")) {
            content = content.slice(0, -2);
          }

          const filePath = path.join(transferPath, filename);
          fs.writeFileSync(filePath, content, "binary");
          savedCount++;
        }

        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: true, count: savedCount }));
      });
      return;
    }

    res.writeHead(404);
    res.end("Not found");
  });

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`Transfer server running at http://${localIP}:${PORT}`);
    exec(`open http://localhost:${PORT}`);
  });

  return `Transfer server started at http://${localIP}:${PORT}`;
};

