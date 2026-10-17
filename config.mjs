import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
const persistentRuntime = path.join(root, "fictionlogwriter-runtime");

export const config = Object.freeze({
  shell: {
    maxTimeoutSeconds: 12,
    maxOutputChars: 250000,
  },
  mcp: {
    maxSynchronousRequestSeconds: 15,
  },
  fictionlog: {
    persistentRuntime,
    firefoxProfileRoot: path.join(persistentRuntime, "firefox-profile"),
    geckodriverPath: path.join(persistentRuntime, "browser-drivers", "geckodriver.exe"),
  },
});
