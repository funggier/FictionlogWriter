import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));

export const config = Object.freeze({
  shell: {
    maxTimeoutSeconds: 12,
    maxOutputChars: 250000,
  },
  mcp: {
    maxSynchronousRequestSeconds: 15,
  },
  fictionlog: {
    allowedHosts: ["fictionlog.co", "www.fictionlog.co"],
    firefoxProfileRoot: path.join(root, "runtime", "firefox-profile"),
  },
});
