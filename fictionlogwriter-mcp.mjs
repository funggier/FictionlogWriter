import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { configureRuntime } from "./modules/runtime.mjs";
import { registerBrowserCommonTools, defaultBrowserCommonLayer } from "./modules/browser-common.mjs";
import { registerFirefoxAdapter } from "./modules/browser-firefox.mjs";
import { registerBrowserLiveTools } from "./modules/browser-live.mjs";
import { FictionlogBrowserLayer } from "./modules/fictionlog-policy.mjs";
import { config } from "./config.mjs";

configureRuntime({
  maxSynchronousRequestSeconds: config.mcp.maxSynchronousRequestSeconds,
});

const server = new McpServer({
  name: "FictionlogWriter",
  version: "0.1.0",
});

registerFirefoxAdapter(defaultBrowserCommonLayer);
const restrictedLayer = new FictionlogBrowserLayer(defaultBrowserCommonLayer, {
  allowedHosts: config.fictionlog.allowedHosts,
  firefoxProfileRoot: config.fictionlog.firefoxProfileRoot,
});

registerBrowserCommonTools(server, config, restrictedLayer);
registerBrowserLiveTools(server, config);

console.error("FictionlogWriter 0.1.0 starting; scope=fictionlog.co; browser=firefox");
await server.connect(new StdioServerTransport());
