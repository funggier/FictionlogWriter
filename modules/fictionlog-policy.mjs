function domainError(message) {
  const error = new Error("FICTIONLOG_DOMAIN_BLOCKED: " + message);
  error.code = "FICTIONLOG_DOMAIN_BLOCKED";
  return error;
}

export function assertFictionlogUrl(raw, allowedHosts = ["fictionlog.co", "www.fictionlog.co"]) {
  let url;
  try {
    url = new URL(raw);
  } catch {
    throw domainError("Invalid URL: " + raw);
  }
  if (url.protocol !== "https:") {
    throw domainError("Only HTTPS Fictionlog URLs are allowed.");
  }
  if (!allowedHosts.includes(url.hostname.toLowerCase())) {
    throw domainError("Host " + url.hostname + " is outside FictionlogWriter scope.");
  }
  return url.toString();
}

export class FictionlogBrowserLayer {
  constructor(inner, {
    allowedHosts = ["fictionlog.co", "www.fictionlog.co"],
    firefoxProfileRoot,
  } = {}) {
    this.inner = inner;
    this.allowedHosts = allowedHosts;
    this.firefoxProfileRoot = firefoxProfileRoot;
  }

  async start({ browser, url = "https://fictionlog.co/", headless = false, options = {} }) {
    const safeUrl = assertFictionlogUrl(url || "https://fictionlog.co/", this.allowedHosts);
    if (browser !== "firefox") {
      throw new Error("FICTIONLOG_BROWSER_UNSUPPORTED: FictionlogWriter currently exposes Firefox only.");
    }
    const safeOptions = {
      ...options,
      profile_root: this.firefoxProfileRoot,
      unsafe_allow_external_profile: true,
    };
    return this.inner.start({ browser, url: safeUrl, headless, options: safeOptions });
  }

  attach(args) { return this.inner.attach(args); }
  stop(args) { return this.inner.stop(args); }
  tabs(args) { return this.inner.tabs(args); }
  snapshot(args) { return this.inner.snapshot(args); }
  click(args) { return this.inner.click(args); }
  type(args) { return this.inner.type(args); }
  screenshot(args) { return this.inner.screenshot(args); }

  navigate(args) {
    return this.inner.navigate({
      ...args,
      url: assertFictionlogUrl(args.url, this.allowedHosts),
    });
  }
}
