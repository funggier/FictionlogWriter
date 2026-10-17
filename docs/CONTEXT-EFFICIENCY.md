# Context Efficiency

FictionlogWriter uses conditional reads only where the browser operation is safely read-only.

## Cached surfaces

- `browser_tabs`
- `browser_snapshot`

Both accept `known_digest` and `cache_max_age_ms`.

A positive TTL may skip re-execution when matching digest metadata is fresh. TTL 0 always performs a fresh browser read, then suppresses the payload when its SHA-256 digest is unchanged.

## Never cached

- browser session start/stop
- navigation
- click
- type
- screenshot
- any future operation with side effects

State-changing browser calls invalidate all conditional-read metadata.

## Data retention boundary

The cache stores only digest, byte/character counts, and timestamps. Browser result content is never retained by the cache. Canonicalized read arguments are hashed before becoming cache keys.
