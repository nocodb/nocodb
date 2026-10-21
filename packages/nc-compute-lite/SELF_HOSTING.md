# Self-hosting sandboxes with nc-compute-lite

On-prem NocoDB runs user code in sandboxes: scripts and workflow "Run script"
steps, script buttons, AI chat code execution and file generation, the App
Builder and app actions. In NocoDB Cloud these run on E2B. On your own servers,
**nc-compute-lite** runs them as containers on plain Docker: no KVM, no cloud
account.

```
 NocoDB ──HTTP (API key)──▶ nc-compute-lite :8430  ──▶ Docker ──▶ sandbox containers
   │                                                              ▲
   └──HTTP/WebSocket──────▶ nc-compute-lite :8431 (port proxy) ──┘
```

NocoDB never gets a Docker socket; it only talks to lite's API.

## 1. Requirements

| | |
|---|---|
| Host | Linux, x86-64 (amd64) or ARM64, Docker 24+ |
| CPU / memory | per running sandbox: chat 2 vCPU / 1 GB, script 2 / 1 GB, app builder 2 / 4 GB, app action 1 / 1 GB; size for how many run at once |
| Disk | ~20 GB for sandbox images (the chat image alone is ~14 GB), plus sandbox files |
| Network | NocoDB must reach lite on 8430 and 8431; sandboxes need outbound internet for packages unless you deny it |
| DNS | a wildcard name for the lite host, e.g. `*.sandbox.example.com` |

Lite needs a dedicated host or VM in **host** mode; **embedded** mode can share
a host with NocoDB.

## 2. Choose a mode

| | Embedded (recommended) | Host |
|---|---|---|
| Docker engine | lite runs its own, inside its container | the host's, via its socket |
| Needs | `--privileged` | `/var/run/docker.sock` mounted, `--network host` |
| Docker isolation | sandboxes can't see or manage your other containers | lite only touches containers it created |
| Network isolation | lite blocks sandbox traffic to private addresses (your database, Redis, cloud metadata); the public internet stays open | sandboxes reach private addresses like any container until you add the firewall rule in section 8 |
| Restart behaviour | a lite restart stops sandboxes (files kept; they resume on next use) | sandboxes keep running |

## 3. Install

Generate one key and keep it; NocoDB uses the same one.

```bash
export NC_COMPUTE_LITE_KEY=$(openssl rand -hex 24)
```

**Embedded:**

```bash
docker run -d --name nc-compute-lite --restart unless-stopped --privileged \
  -p 8430:8430 -p 8431:8431 \
  -v nc-compute-lite:/var/lib/docker \
  -e NC_COMPUTE_LITE_KEY \
  nocodb/nc-compute-lite:latest
```

**Host:**

```bash
docker run -d --name nc-compute-lite --restart unless-stopped --network host \
  -v /var/run/docker.sock:/var/run/docker.sock \
  -e NC_COMPUTE_LITE_KEY \
  nocodb/nc-compute-lite:latest
```

**Docker Compose, next to NocoDB (embedded):**

```yaml
services:
  nocodb:
    image: nocodb/nocodb-ee:<version>
    environment:
      NC_COMPUTE_LITE_URL: http://compute-lite:8430
      NC_COMPUTE_LITE_KEY: ${NC_COMPUTE_LITE_KEY}
      NC_COMPUTE_LITE_DOMAIN: sandbox.example.com:8431
      # ...your usual NocoDB settings
  compute-lite:
    image: nocodb/nc-compute-lite:latest
    privileged: true
    restart: unless-stopped
    ports: ['8431:8431']   # the port proxy must be reachable at NC_COMPUTE_LITE_DOMAIN
    volumes: [compute-lite:/var/lib/docker]
    environment:
      NC_COMPUTE_LITE_KEY: ${NC_COMPUTE_LITE_KEY}
volumes:
  compute-lite:
```

Check it is up:

```bash
curl http://<lite-host>:8430/health   # {"ok":true,"docker":"embedded",...}
```

## 4. DNS for sandbox ports

Sandbox ports are reached by hostname: `<port>-<sandbox id>.<domain>`. Point a
wildcard record at the lite host:

```
*.sandbox.example.com.  A  <lite host IP>
```

Use a domain of its own, not a subdomain of NocoDB's: sandboxes answer under it
and could set cookies for it.

**TLS (optional):** put a reverse proxy (Caddy, nginx, Traefik) in front of
port 8431 with a wildcard certificate for `*.sandbox.example.com`, forwarding
HTTP and WebSocket with the `Host` header intact. Then set
`NC_COMPUTE_LITE_DOMAIN=sandbox.example.com` (no port) and
`NC_COMPUTE_LITE_TLS=true` in NocoDB.

## 5. Connect NocoDB

Set these on NocoDB and restart it:

| Setting | Example | |
|---|---|---|
| `NC_COMPUTE_LITE_URL` | `http://compute-lite:8430` | lite's API, as NocoDB reaches it |
| `NC_COMPUTE_LITE_KEY` | the key from step 3 | |
| `NC_COMPUTE_LITE_DOMAIN` | `sandbox.example.com:8431` | the wildcard domain, with the proxy port unless TLS fronts it on 443 |
| `NC_COMPUTE_LITE_TLS` | `true` | only behind a TLS proxy |

All three of URL, key and domain must be set. When they are, NocoDB uses lite
for every sandbox, ahead of any other compute.

**Check it works:** run a script from a workflow or button, or ask the AI chat
to "run 1 + 1 in Python". The first run of each kind pulls its image (see
below), so it can take a few minutes.

## 6. Sandbox images

Each NocoDB release pins its sandbox images by digest, so a NocoDB version
always runs the exact images it was released and tested with:
`nocodb/nc-chat-template`, `nc-script-template`, `nc-app-builder`,
`nc-app-runtime`. They are multi-platform (amd64 and arm64); Docker pulls your
host's. Lite pulls each on first use.

**Pull ahead of time** (avoids a slow first run): run a script, a chat code
cell and an app build once after installing, or in embedded mode pull inside
lite's engine:

```bash
docker exec nc-compute-lite docker pull nocodb/nc-chat-template:<tag>
```

**Private registry or air-gapped:** mirror the images and point NocoDB at them,
one setting per workload: `NC_COMPUTE_LITE_IMAGE_CHAT`,
`NC_COMPUTE_LITE_IMAGE_SCRIPT`, `NC_COMPUTE_LITE_IMAGE_APP_BUILDER`,
`NC_COMPUTE_LITE_IMAGE_APP_RUNTIME`. Air-gapped, load them into lite's engine:

```bash
docker save nocodb/nc-chat-template:<tag> | docker exec -i nc-compute-lite docker load
```

## 7. Settings

| lite setting | Default | |
|---|---|---|
| `NC_COMPUTE_LITE_KEY` | required | API key, 32+ characters |
| `NC_COMPUTE_LITE_PORT` | 8430 | API port |
| `NC_COMPUTE_LITE_PROXY_PORT` | 8431 | sandbox port proxy |
| `NC_COMPUTE_LITE_MAX_SANDBOXES` | 50 | running at once; past it NocoDB reports "too many machines" |
| `NC_COMPUTE_LITE_PAUSED_RETENTION_HOURS` | 168 | paused chat sandboxes are deleted after this |
| `NC_COMPUTE_LITE_DOCKER` | auto | `host` or `embedded`; auto picks host when a socket is mounted |
| `NC_COMPUTE_LITE_ADDRESS_POOL` | 10.213.0.0/16 | embedded: sandbox network range; must not overlap your networks |
| `NC_COMPUTE_LITE_BRIDGE_IP` | 10.214.0.1/24 | embedded: inner engine's default bridge |
| `NC_COMPUTE_LITE_ALLOW_PRIVATE` | none | embedded: private CIDRs sandboxes may reach (comma-separated) |

## 8. Security

- Every request to lite needs the API key; every sandbox port needs its own
  per-sandbox token, which NocoDB sends. Sandboxes can't call lite's API or
  reach each other.
- Sandboxes run code an AI may have written, steered by whatever files users
  upload. They are containers sharing the host kernel, not VMs: treat the lite
  host as running untrusted code.
- **Private networks are off limits in embedded mode.** At startup lite drops
  sandbox traffic to 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16, 100.64.0.0/10
  and 169.254.0.0/16 (cloud metadata), so a sandbox can't reach NocoDB's
  database, Redis or anything else on your networks; the public internet stays
  open for packages and APIs. Lite refuses to start if it can't install the
  rule. To let sandboxes reach a private service (an internal package
  registry or proxy), list it in `NC_COMPUTE_LITE_ALLOW_PRIVATE`, e.g.
  `10.1.2.3/32,10.20.0.0/16`.
- **Host mode needs the same rule on the host**, since lite doesn't own that
  engine. As root, after lite has started once (it creates its networks):

  ```bash
  for net in nc-compute-lite nc-compute-lite-internal; do
    subnet=$(docker network inspect -f '{{(index .IPAM.Config 0).Subnet}}' $net)
    for dst in 10.0.0.0/8 172.16.0.0/12 192.168.0.0/16 100.64.0.0/10 169.254.0.0/16; do
      iptables -I DOCKER-USER -s "$subnet" -d "$dst" -j DROP
    done
    iptables -I DOCKER-USER -s "$subnet" -m conntrack --ctstate ESTABLISHED,RELATED -j RETURN
  done
  ```

  Make it persistent with your distribution's iptables tooling.
- App actions run with no internet access at all.

## 9. Operating it

**Upgrade lite:** pull the new image and recreate the container. Running
sandboxes are rebuilt from Docker on start; in embedded mode they are stopped
and resume on next use.

```bash
docker pull nocodb/nc-compute-lite:latest
docker rm -f nc-compute-lite && docker run ...   # same command as install
```

Sandbox images upgrade with NocoDB: a new NocoDB version pins new digests and
lite pulls them on next use. Old images can be pruned with
`docker exec nc-compute-lite docker image prune -a` (embedded).

**Logs:** `docker logs nc-compute-lite` (one JSON line per event or error).

**Backups:** nothing to back up. Sandboxes are disposable; chat files that
matter are attached to the chat in NocoDB's storage.

## 10. Troubleshooting

| Symptom | Likely cause / fix |
|---|---|
| "The machine could not be woken" / scripts fail at once | NocoDB can't reach `NC_COMPUTE_LITE_URL`, or the key differs; `curl <url>/health` from the NocoDB container |
| Chat or app builder hangs, then "agent could not be reached" | `NC_COMPUTE_LITE_DOMAIN` is wrong, missing the `:8431` port, or the wildcard DNS doesn't resolve from NocoDB |
| "Too many machines are running" | raise `NC_COMPUTE_LITE_MAX_SANDBOXES` or add capacity |
| First run very slow | the image is being pulled; pull ahead of time (section 6) |
| `image … is built for amd64; this Docker host is arm64` | an image override points at a single-platform build; use the published images or build for your platform |
| Embedded mode won't start: "embedded Docker engine did not start" | run with `--privileged`, or switch to host mode |
| 403 "not reachable from a sandbox" from NocoDB | NocoDB's network overlaps lite's sandbox range; set `NC_COMPUTE_LITE_ADDRESS_POOL` to a free range and recreate lite's volume |

## How images reach you (for maintainers)

All automatic:

1. A change to a template merges into `nocodb/nc-e2b-template`. Its CI builds
   the E2B template and the Docker image for each platform, merges them into one
   multi-platform image, pushes it to Docker Hub, and opens a PR on nocohub
   pinning the new E2B id and Docker digest in `templates.ts`.
2. That PR merges; the next NocoDB release ships the new pins.
3. A change to `packages/nc-compute-lite` merging into nocohub `develop` builds
   and pushes `nocodb/nc-compute-lite:<sha>` and `:latest` for amd64 and arm64.
