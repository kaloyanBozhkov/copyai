import http from "http";
import { cmdKitchen, utensilsKeys, getArgs, refreshCommandKeys } from "../kitchen/cmdKitchen";

const PORT = 4269;

interface CommandInfo {
  name: string;
  args: string[];
}

interface ExecuteRequest {
  command: string;
  args?: string[];
}

interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

let server: http.Server | null = null;

/**
 * Get all available commands with their expected arguments
 */
const getCommands = (): CommandInfo[] => {
  refreshCommandKeys(); // Ensure fresh list
  return utensilsKeys.map((key) => ({
    name: key,
    args: getArgs(key),
  }));
};

/**
 * Execute a command with optional arguments
 */
const executeCommand = async (
  command: string,
  args?: string[]
): Promise<ApiResponse<string | boolean>> => {
  try {
    const result = await cmdKitchen(command, args);
    
    if (result === undefined) {
      return { success: false, error: `Unknown command: ${command}` };
    }
    
    if (result === false) {
      return { success: false, error: "Command execution failed" };
    }
    
    return { success: true, data: result };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
};

/**
 * Parse JSON body from request
 */
const parseBody = <T>(req: http.IncomingMessage): Promise<T> => {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        reject(new Error("Invalid JSON body"));
      }
    });
    req.on("error", reject);
  });
};

/**
 * Send JSON response
 */
const sendJson = <T>(
  res: http.ServerResponse,
  data: T,
  statusCode = 200
): void => {
  res.writeHead(statusCode, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  });
  res.end(JSON.stringify(data));
};

/**
 * Start the MCP server
 */
export const startMCPServer = (): Promise<void> => {
  return new Promise((resolve, reject) => {
    if (server) {
      console.log("MCP server already running");
      resolve();
      return;
    }

    server = http.createServer(async (req, res) => {
      const url = new URL(req.url || "/", `http://localhost:${PORT}`);
      const path = url.pathname;

      // Handle CORS preflight
      if (req.method === "OPTIONS") {
        res.writeHead(204, {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
        });
        res.end();
        return;
      }

      try {
        // GET / or GET /commands - List all commands
        if ((path === "/" || path === "/commands") && req.method === "GET") {
          const commands = getCommands();
          sendJson(res, {
            success: true,
            data: {
              commands,
              count: commands.length,
            },
          });
          return;
        }

        // GET /command/:name - Get info about a specific command
        if (path.startsWith("/command/") && req.method === "GET") {
          const commandName = decodeURIComponent(path.replace("/command/", ""));
          const args = getArgs(commandName);
          
          if (!utensilsKeys.includes(commandName)) {
            sendJson(res, { success: false, error: "Command not found" }, 404);
            return;
          }
          
          sendJson(res, {
            success: true,
            data: { name: commandName, args },
          });
          return;
        }

        // POST /execute - Execute a command
        if (path === "/execute" && req.method === "POST") {
          const body = await parseBody<ExecuteRequest>(req);
          
          if (!body.command) {
            sendJson(res, { success: false, error: "Missing 'command' field" }, 400);
            return;
          }
          
          const result = await executeCommand(body.command, body.args);
          sendJson(res, result, result.success ? 200 : 400);
          return;
        }

        // GET /execute/:command?args=... - Execute via GET (convenience)
        if (path.startsWith("/execute/") && req.method === "GET") {
          const commandName = decodeURIComponent(path.replace("/execute/", ""));
          const argsParam = url.searchParams.get("args");
          const args = argsParam ? argsParam.split(",").map((a) => a.trim()) : undefined;
          
          const result = await executeCommand(commandName, args);
          sendJson(res, result, result.success ? 200 : 400);
          return;
        }

        // 404 for unknown routes
        sendJson(res, { success: false, error: "Not found" }, 404);
      } catch (error) {
        console.error("MCP server error:", error);
        sendJson(
          res,
          {
            success: false,
            error: error instanceof Error ? error.message : "Internal server error",
          },
          500
        );
      }
    });

    server.on("error", (err) => {
      console.error("MCP server error:", err);
      reject(err);
    });

    server.listen(PORT, "127.0.0.1", () => {
      console.log(`MCP server running at http://127.0.0.1:${PORT}`);
      console.log("Endpoints:");
      console.log(`  GET  /commands       - List all commands`);
      console.log(`  GET  /command/:name  - Get command info`);
      console.log(`  POST /execute        - Execute command { command, args? }`);
      console.log(`  GET  /execute/:cmd   - Execute via GET`);
      resolve();
    });
  });
};

/**
 * Stop the MCP server
 */
export const stopMCPServer = (): Promise<void> => {
  return new Promise((resolve) => {
    if (server) {
      server.close(() => {
        server = null;
        console.log("MCP server stopped");
        resolve();
      });
    } else {
      resolve();
    }
  });
};

/**
 * Check if MCP server is running
 */
export const isMCPServerRunning = (): boolean => {
  return server !== null;
};
