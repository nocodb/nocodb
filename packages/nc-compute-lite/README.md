# nc-compute-lite

Sandboxes for an on-prem NocoDB on plain Docker: scripts, AI chat code
execution, app runtime and app builder. No KVM, no template builds on the
customer's host: sandbox images are pulled like any other image.

It is its own container. NocoDB talks to it over HTTP with an API key and never
gets a Docker socket.

## Install

Two ways to run the same image:

```bash
# embedded: lite runs its own Docker engine; nothing else on the host is visible to it
docker run -d --name nc-compute-lite --privileged \
  -p 8430:8430 -p 8431:8431 -v nc-compute-lite:/var/lib/docker \
  -e NC_COMPUTE_LITE_KEY=$(openssl rand -hex 24) \
  nocodb/nc-compute-lite:<version>

# host: lite uses the host's Docker (and so controls it); give it a dedicated host
docker run -d --name nc-compute-lite --network host \
  -v /var/run/docker.sock:/var/run/docker.sock \
  -e NC_COMPUTE_LITE_KEY=$(openssl rand -hex 24) \
  nocodb/nc-compute-lite:<version>
```

The mode follows the mount: a mounted Docker socket means host, otherwise
embedded. `NC_COMPUTE_LITE_DOCKER=host|embedded` forces one. In host mode lite
touches only containers it labelled `nc-compute-lite=1`.

| Setting | Default | |
|---|---|---|
| `NC_COMPUTE_LITE_KEY` | required | API key, 32+ characters |
| `NC_COMPUTE_LITE_PORT` | 8430 | API |
| `NC_COMPUTE_LITE_PROXY_PORT` | 8431 | sandbox ports, by hostname |
| `NC_COMPUTE_LITE_MAX_SANDBOXES` | 50 | running at once; past it, create answers 429 |
| `NC_COMPUTE_LITE_PAUSED_RETENTION_HOURS` | 168 | a paused sandbox is deleted after this |

Only NocoDB needs to reach 8430 and 8431.

## Sandbox ports

`<port>-<sandbox id>.<any domain>` on 8431 reaches that port of that sandbox,
HTTP and WebSocket. Point a wildcard DNS name at the host and set it as
NocoDB's lite domain. A sandbox created with `requireAuth` answers only callers
sending its traffic token in `e2b-traffic-access-token`.

## API

`Authorization: Bearer <key>` on everything but `/health` and signed downloads.

| Call | |
|---|---|
| `POST /v1/sandboxes` | `{image, workload?, timeoutMs?, envs?, metadata?, egress?: {denyInternet}, ingress?: {requireAuth}, onTimeout?: 'pause'\|'kill', cpuCount?, memoryMB?}` → the sandbox, with `trafficToken` when auth is required |
| `GET /v1/sandboxes?state=&metadata=` | list; `metadata` is a JSON object to match |
| `GET` / `DELETE /v1/sandboxes/:id` | one sandbox / kill it |
| `POST /v1/sandboxes/:id/timeout` | `{timeoutMs}`; 409 when paused or exited, so it doubles as a liveness check |
| `POST /v1/sandboxes/:id/pause`, `/resume` | stop / start the container: files stay, processes don't |
| `PUT` / `GET /v1/sandboxes/:id/files?path=&user=&mode=` | write a file as `user` or `root` / read one |
| `POST /v1/sandboxes/:id/download-url` | `{path, ttlSeconds?}` → a signed URL that needs no key |
| `/v1/sandboxes/:id/code/*` | the sandbox's code server (E2B code-interpreter's, port 49999), streamed |

At its deadline a sandbox is paused (`onTimeout: 'pause'`) or deleted.

## What it does not do

- **Memory across pause.** Pause stops the container: files survive, running
  processes and Python variables do not. NocoDB recreates state it needs.
- **Egress allowlists.** `denyInternet` is enforced (a network with no route
  out); `allowOut` is refused rather than ignored.
- **VM isolation.** Sandboxes are containers on the host's kernel, with
  `NET_RAW` dropped, a pid limit, and no sandbox-to-sandbox traffic.

## Images

Built and published from `nocodb/nc-e2b-template` (`docker/`), from the same
sources as the E2B templates. The pin PR pins each by digest in nocohub's
`DOCKER_IMAGES`, next to its E2B id, so a NocoDB version always runs the exact
images it was released with. `NC_COMPUTE_LITE_IMAGE_<WORKLOAD>` points one
elsewhere (a local build, a private mirror).

## Test

`test/e2e.ts` runs against a live lite: the calls NocoDB's machine provider makes.

```bash
LITE_URL=http://127.0.0.1:8430 LITE_PROXY=127.0.0.1:8431 NC_COMPUTE_LITE_KEY=… IMAGE=… node test/e2e.ts
```
