// server.mjs (ESM)
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const server = new Server(
  { name: "repomix-wrapper", version: "1.0.0" },
  {
    "tools/list": async () => ({
      tools: [
        {
          name: "pack_codebase",
          description: "Run repomix on a directory and produce a pack file.",
          inputSchema: {
            type: "object",
            required: ["directory"],
            properties: {
              directory: { type: "string" },
              style: { type: "string", enum: ["markdown", "xml"], default: "markdown" },
              output: { type: "string", default: "repomix.md" },
              compress: { type: "boolean", default: false }
            }
          }
        }
      ]
    }),
    "tools/call": async ({ name, arguments: args }) => {
      if (name !== "pack_codebase") {
        return { content: [{ type: "text", text: `Unknown tool: ${name}` }] };
      }

      const dir = args.directory;
      const style = args.style || "markdown";
      const output = args.output || "repomix.md";
      const compress = args.compress ? ["--compress"] : [];
      const cmdArgs = ["--style", style, "--output", output, "--dir", dir, ...compress];

      try {
        const { stdout } = await execFileAsync("repomix", cmdArgs, { windowsHide: true });
        return {
          content: [
            { type: "text", text: `✅ Packed: ${dir}\n➡️ Output: ${output}\n\n${stdout.slice(0,4000)}` }
          ]
        };
      } catch (e) {
        return { content: [{ type: "text", text: `❌ repomix failed: ${e.message}` }] };
      }
    }
  }
);

// Minimal HTTP/SSE transport
import express from "express";

const app = express();
app.use(express.json());

app.get("/sse", async (req, res) => {
  const transport = new SSEServerTransport("/messages", res);
  await server.connect(transport);
});

app.post("/messages", async (req, res) => {
  res.status(200).end();
});

app.listen(3333, () => {
  console.log("MCP SSE server running at http://localhost:3333/sse");
});