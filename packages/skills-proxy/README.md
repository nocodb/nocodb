# nc-skills-proxy

A caching read-only proxy for the [skills.sh](https://skills.sh) catalog API.

## Why this exists

Every `skills.sh/api/v1/*` endpoint returns `401 authentication_required`
without a **Vercel OIDC token**:

```
$ curl -s https://skills.sh/api/v1/skills/curated
{"error":"authentication_required","message":"This endpoint requires authentication.
 Pass a Vercel OIDC token (Authorization: Bearer <VERCEL_OIDC_TOKEN>)…"}
```

That token is minted by Vercel per (team, project) for a Vercel deployment. A
self-hosted NocoDB pod cannot obtain one at all, and NocoDB Cloud does not run
on Vercel either. This service is the one piece that does: it holds the
identity, caches hard in front of it, and re-serves the catalog to every NocoDB
instance over plain HTTP.

The budget it protects is **600 requests/minute for the whole deployment**,
shared across every instance pointed at it — which is why the caching here is
not an optimisation but the point.

### What is *not* proxied

`skills.sh/api/download/{owner}/{repo}/{slug}` is **public** and needs no token.
NocoDB fetches skill bundles from it (or from GitHub) directly; routing them
through here would add a hop and a cache for no benefit.

## Endpoints

Paths mirror upstream exactly, so pointing a client at `https://skills.sh`
instead — given a token — behaves identically.

| Route | Cached | Notes |
|---|---|---|
| `GET /healthz` | — | `{ ok, cached }` |
| `GET /api/v1/skills` | 60s | `view` (`all-time`\|`trending`\|`hot`), `page`, `per_page` |
| `GET /api/v1/skills/search` | 60s | `q` (≥2 chars, required), `limit`, `owner` |
| `GET /api/v1/skills/curated` | 300s | |
| `GET /api/v1/skills/*` | 300s | skill detail, `{source}/{skill}` |
| `GET /api/v1/skills/audit/*` | 300s | |

### Internal

Operator-only, behind HTTP basic auth. Not part of the upstream-mirroring
surface — these exist because everything else here is a read-through cache with
no way to correct it, and upstream's TTL is otherwise the only thing that
expires a copy you already know is wrong.

| Route | Notes |
|---|---|
| `GET /internal/status` | Upstream URL, whether an OIDC token exists (never its value), entry count, TTLs, uptime, which instance answered |
| `GET /internal/cache` | Cache keys with age and freshness. `?prefix=` narrows. Keys only — values can be megabytes |
| `DELETE /internal/cache` | Drops everything, or everything under `?prefix=`. Returns `{ dropped, remaining }` |

Prefixes are the cache keys `routes.ts` builds: `leaderboard:`, `search:`,
`public-search:`, `curated`, `detail:`, `audit:`.

```bash
curl -u ops:$PASSWORD https://<host>/internal/cache?prefix=detail:
curl -u ops:$PASSWORD -X DELETE https://<host>/internal/cache?prefix=detail:
```

**The cache is per-instance** (see below), so a flush clears whichever instance
answered the call. On Vercel that is one of several, and this service cannot
fan a flush out to its siblings. Call it until `dropped` comes back `0`, or
redeploy — which replaces every instance at once and is the only way to be sure.

Both `SKILLS_PROXY_INTERNAL_USER` and `SKILLS_PROXY_INTERNAL_PASSWORD` must be
set or **the routes are not registered at all** and return 404. That is
deliberate: a deployment that forgot to configure them must not leave a cache
flush open to anyone who guesses the path.

TTLs match the `Cache-Control` skills.sh sets on each endpoint. Responses carry
`Cache-Control: public, max-age=<ttl>, stale-while-revalidate=<ttl*10>` so
callers cache too.

## Caching behaviour

Three properties, all serving the same rate-limit goal:

- **TTL** — repeat browsing never reaches the wire.
- **Single-flight** — concurrent misses on one key collapse into one upstream
  call. Verified: 40 simultaneous requests → 1 upstream hit.
- **Serve-stale-on-error** — when upstream 429s or fails, the last good value is
  served for up to 24h with an `x-skills-proxy-stale: 1` header. A cold key with
  nothing to fall back on passes the upstream status and `Retry-After` through
  unchanged, rather than inventing an empty catalog.

Failures are never cached.

The cache is in-memory and per-instance, so the true upstream rate is this
times the running instance count — still far inside 600/min, and an external
store would add a dependency to a service whose whole job is to be cheap.

## Abuse control

**The catalog routes are not rate limited.** They used to carry a per-IP limit,
which was wrong here: NocoDB instances reach this service through our own proxy,
so every caller arrives on one forwarded address and the limit counted all of
them as a single abusive client — we throttled ourselves. Vercel's bot
protection covers what that limit was there for.

What actually protects the 600/min upstream budget is the cache, not a limit on
the way in: a cache hit costs nothing upstream, so throttling hits bought
nothing. Single-flight bounds the worst case for any one key, and
serve-stale-on-error means exceeding the budget degrades rather than breaks.

`/internal/*` is the exception and keeps a limit of **30 req/min**, because it
writes and nothing legitimate calls it in a loop — its job is to bound password
guessing, not to shape traffic. No NocoDB instance calls it, so it cannot
contribute to the self-throttling above. Credentials are compared as SHA-256
digests via `timingSafeEqual`, so the check is constant-time and a length
mismatch cannot throw.

## Local development

```bash
pnpm install --filter nc-skills-proxy
pnpm --filter nc-skills-proxy dev        # tsx watch on :3000
pnpm --filter nc-skills-proxy test       # cache unit tests
pnpm --filter nc-skills-proxy typecheck
```

Without `VERCEL_OIDC_TOKEN` set, upstream calls return `503 oidc_unavailable` —
routes, validation and caching still work. Use `vercel dev` for a real token, or
point `SKILLS_UPSTREAM_URL` at a stub.

## Deployment

Zero-config on Vercel: the entrypoint is `src/index.ts` and calls
`fastify.listen`, which is what Vercel's Fastify detection looks for. The whole
app becomes one Function on Fluid compute.

**Enable OIDC Federation in the Vercel project settings** — without it
`VERCEL_OIDC_TOKEN` is never injected and every upstream call 503s.

```bash
vc deploy    # Vercel CLI ≥ 48.6.0
```

## Configuration

| Variable | Default | Purpose |
|---|---|---|
| `VERCEL_OIDC_TOKEN` | injected by Vercel | Upstream credential. Read per request because Vercel rotates it. |
| `SKILLS_UPSTREAM_URL` | `https://skills.sh` | Point at a stub for tests. |
| `SKILLS_PROXY_INTERNAL_USER` | unset | Basic-auth user for `/internal/*`. Unset (either half) disables those routes entirely. |
| `SKILLS_PROXY_INTERNAL_PASSWORD` | unset | Basic-auth password. May contain colons. |
| `PORT` | `3000` | |
