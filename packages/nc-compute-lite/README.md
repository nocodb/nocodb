# nc-compute-lite

Sandboxes for on-prem NocoDB (Enterprise license) on plain Docker: scripts,
AI chat code, app builder and app runtime. No KVM needed. NocoDB talks to it over HTTP with an
API key and never gets a Docker socket.

Setting it up for a NocoDB install: [SELF_HOSTING.md](SELF_HOSTING.md).

## Run

```bash
# embedded (recommended): lite runs its own Docker engine
docker run -d --name nc-compute-lite --privileged \
  -p 8430:8430 -p 8431:8431 -v nc-compute-lite:/var/lib/docker \
  -e NC_COMPUTE_LITE_KEY=$(openssl rand -hex 24) \
  nocodb/nc-compute-lite:<version>

# host: uses the host's Docker; give it a dedicated host
docker run -d --name nc-compute-lite --network host \
  -v /var/run/docker.sock:/var/run/docker.sock \
  -e NC_COMPUTE_LITE_KEY=$(openssl rand -hex 24) \
  nocodb/nc-compute-lite:<version>
```

A mounted Docker socket means host mode; `NC_COMPUTE_LITE_DOCKER=host|embedded`
forces one. In host mode lite only touches containers it created.

| Setting | Default | |
|---|---|---|
| `NC_COMPUTE_LITE_KEY` | required | API key, 32+ characters |
| `NC_COMPUTE_LITE_PORT` | 8430 | API |
| `NC_COMPUTE_LITE_PROXY_PORT` | 8431 | sandbox ports |
| `NC_COMPUTE_LITE_MAX_SANDBOXES` | 50 | running at once (429 past it) |
| `NC_COMPUTE_LITE_PAUSED_RETENTION_HOURS` | 168 | paused sandboxes are deleted after this |
| `NC_COMPUTE_LITE_ADDRESS_POOL` | 10.213.0.0/16 | embedded: sandbox networks' range; keep it clear of NocoDB's networks |
| `NC_COMPUTE_LITE_BRIDGE_IP` | 10.214.0.1/24 | embedded: the inner engine's default bridge |
| `NC_COMPUTE_LITE_ALLOW_PRIVATE` | none | embedded: private CIDRs sandboxes may still reach |

## Connect NocoDB

| NocoDB setting | Value |
|---|---|
| `NC_COMPUTE_LITE_URL` | `http://<lite-host>:8430` |
| `NC_COMPUTE_LITE_KEY` | the same key |
| `NC_COMPUTE_LITE_DOMAIN` | a wildcard DNS name for the lite host, with the proxy port: `sandbox.example.internal:8431` |
| `NC_COMPUTE_LITE_TLS` | `true` when a TLS proxy fronts the sandbox domain on 443 |
| `NC_COMPUTE_LITE_IMAGE_<WORKLOAD>` | optional: a different image for `CHAT`, `SCRIPT`, `APP_BUILDER` or `APP_RUNTIME` |

Only NocoDB needs to reach 8430 and 8431. Give the sandbox domain its own
registrable domain, not a subdomain of NocoDB's.

## Good to know

- **Pause keeps files, not memory.** Pause stops the container; resume reports
  `restarted: true` and NocoDB tells the AI chat its variables are gone.
- **Every sandbox port needs its traffic token**, unlike E2B; the code server
  is never exposed.
- **Internet:** `denyInternet` is enforced; egress allowlists are refused.
- **Isolation is a container, not a VM.** Embedded mode drops sandbox traffic
  to private addresses (NocoDB's database, cloud metadata) and keeps the public
  internet; `NC_COMPUTE_LITE_ALLOW_PRIVATE` opens chosen CIDRs. Host mode needs
  the same firewall rule on the host: see SELF_HOSTING.md.
- **Images are multi-platform** (amd64 and arm64 by default), built from
  `nocodb/nc-e2b-template` and pinned by digest in NocoDB; Docker pulls the
  host's. Lite refuses an image built for another CPU.

## API

`Authorization: Bearer <key>` on everything but `/health` and signed downloads.

| Call | |
|---|---|
| `POST /v1/sandboxes` | create: `{image, timeoutMs?, envs?, metadata?, egress?, ingress?, onTimeout?, cpuCount?, memoryMB?}` |
| `GET /v1/sandboxes` | list, filtered by `state` and `metadata` |
| `GET` / `DELETE /v1/sandboxes/:id` | get / kill |
| `POST /v1/sandboxes/:id/timeout` | extend; 409 if not running |
| `POST /v1/sandboxes/:id/pause`, `/resume` | stop / start |
| `PUT` / `GET /v1/sandboxes/:id/files?path=` | write / read a file |
| `POST /v1/sandboxes/:id/download-url` | signed URL for a file |
| `/v1/sandboxes/:id/code/*` | the sandbox's code server, streamed |

## Test

```bash
LITE_URL=http://127.0.0.1:8430 LITE_PROXY=127.0.0.1:8431 NC_COMPUTE_LITE_KEY=… IMAGE=… node test/e2e.ts
```
