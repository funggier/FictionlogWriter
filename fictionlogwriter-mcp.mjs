import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { defaultBrowserCommonLayer } from "./modules/browser-common.mjs";
import { registerFirefoxAdapter } from "./modules/browser-firefox.mjs";
import { FictionlogBrowserLayer } from "./modules/fictionlog-policy.mjs";
import { registerFictionlogTools } from "./modules/fictionlog-tools.mjs";
import { config } from "./config.mjs";

const server = new McpServer({
  name: "FictionlogWriter",
  version: "0.1.0",
});

registerFirefoxAdapter(defaultBrowserCommonLayer);
const restrictedLayer = new FictionlogBrowserLayer(defaultBrowserCommonLayer, {
  allowedHosts: config.fictionlog.allowedHosts,
  firefoxProfileRoot: config.fictionlog.firefoxProfileRoot,
  geckodriverPath: config.fictionlog.geckodriverPath,
});

registerFictionlogTools(server, restrictedLayer);

console.error("FictionlogWriter 0.1.0 starting; scope=fictionlog.co; browser=firefox; tools=8");
await server.connect(new StdioServerTransport());
