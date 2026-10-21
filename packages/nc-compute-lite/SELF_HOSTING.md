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

NocoDB never gets a Docker socket; it only talks to lite's API. Only NocoDB
talks to lite: your users' browsers never do.

**Needs a self-hosted Enterprise license.** On other plans NocoDB ignores the
lite settings and uses its other compute.

## 1. Requirements

| | |
|---|---|
| Host | Linux, x86-64 (amd64) or ARM64, Docker 24+ (or a Kubernetes node that allows privileged pods) |
| CPU / memory | per running sandbox: chat 2 vCPU / 1 GB, script 2 / 1 GB, app builder 2 / 4 GB, app action 1 / 1 GB; size for how many run at once |
| Disk | ~20 GB for sandbox images (the chat image alone is ~14 GB), plus sandbox files |
| Network | sandboxes need outbound internet for packages, unless you deny it |
| DNS | a wildcard record, e.g. `*.sandbox.example.com`, pointing at lite (NocoDB reaches sandbox ports as `<port>-<id>.sandbox.example.com`) |

Generate one key for lite; NocoDB uses the same one:

```bash
openssl rand -hex 24
```

## 2. Docker Compose: NocoDB and lite on one host

Lite runs its own Docker engine inside its container (**embedded** mode).

`.env`:

```bash
NC_LICENSE_KEY=<your Enterprise license key>
NC_COMPUTE_LITE_KEY=<the key from above>
PG_PASSWORD=<a password>
```

`docker-compose.yml`:

```yaml
services:
  nocodb:
    image: nocodb/nocodb-ee:<version>
    restart: unless-stopped
    ports: ['8080:8080']
    environment:
      NC_DB: pg://db:5432?u=nocodb&p=${PG_PASSWORD}&d=nocodb
      NC_LICENSE_KEY: ${NC_LICENSE_KEY}
      NC_COMPUTE_LITE_URL: http://compute-lite:8430
      NC_COMPUTE_LITE_KEY: ${NC_COMPUTE_LITE_KEY}
      NC_COMPUTE_LITE_DOMAIN: sandbox.example.com:8431   # *.sandbox.example.com → this host
    depends_on: [db, compute-lite]

  db:
    image: postgres:16-alpine
    restart: unless-stopped
    environment:
      POSTGRES_USER: nocodb
      POSTGRES_PASSWORD: ${PG_PASSWORD}
      POSTGRES_DB: nocodb
    volumes: [db:/var/lib/postgresql/data]

  compute-lite:
    image: nocodb/nc-compute-lite:latest
    restart: unless-stopped
    privileged: true
    ports: ['8431:8431']   # the sandbox port proxy; firewall it so only NocoDB reaches it
    environment:
      NC_COMPUTE_LITE_KEY: ${NC_COMPUTE_LITE_KEY}
    volumes: [compute-lite:/var/lib/docker]

volumes:
  db:
  compute-lite:
```

```bash
docker compose up -d
docker compose exec compute-lite wget -qO- localhost:8430/health
# {"ok":true,"docker":"embedded",...}
```

## 3. Lite on a separate host

Keeps untrusted code off the NocoDB host. On the lite host:

```bash
docker run -d --name nc-compute-lite --restart unless-stopped --privileged \
  -p 8430:8430 -p 8431:8431 \
  -v nc-compute-lite:/var/lib/docker \
  -e NC_COMPUTE_LITE_KEY=<the key> \
  nocodb/nc-compute-lite:latest
```

Firewall ports 8430 and 8431 so only NocoDB can reach them. Point
`*.sandbox.example.com` at the lite host, and set on NocoDB:

```bash
NC_COMPUTE_LITE_URL=http://<lite host>:8430
NC_COMPUTE_LITE_KEY=<the key>
NC_COMPUTE_LITE_DOMAIN=sandbox.example.com:8431
```

**Host mode** (lite drives that host's own Docker instead of running one): only
on a host dedicated to lite, and add the firewall rules in section 7.

```bash
docker run -d --name nc-compute-lite --restart unless-stopped --network host \
  -v /var/run/docker.sock:/var/run/docker.sock \
  -e NC_COMPUTE_LITE_KEY=<the key> \
  nocodb/nc-compute-lite:latest
```

| | Embedded (recommended) | Host |
|---|---|---|
| Docker engine | lite runs its own, inside its container | the host's, via its socket |
| Needs | `--privileged` | `/var/run/docker.sock` mounted, `--network host` |
| Docker isolation | sandboxes can't see or manage your other containers | lite only touches containers it created |
| Network isolation | lite blocks sandbox traffic to private addresses (your database, Redis, cloud metadata); the public internet stays open | sandboxes reach private addresses like any container until you add the firewall rules in section 7 |
| Restart behaviour | a lite restart stops sandboxes: chat sandboxes keep their files and resume on next use; script and app sandboxes are removed (they are short-lived and recreated) | sandboxes keep running |

## 4. Kubernetes

Lite runs as one privileged pod in embedded mode, with a volume for its engine.
The namespace must allow privileged pods (with Pod Security Admission:
`pod-security.kubernetes.io/enforce: privileged`).

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: nc-compute-lite
stringData:
  NC_COMPUTE_LITE_KEY: <the key>
---
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: nc-compute-lite
spec:
  accessModes: [ReadWriteOnce]
  resources:
    requests:
      storage: 50Gi
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: nc-compute-lite
spec:
  replicas: 1                # one engine per volume
  strategy:
    type: Recreate
  selector:
    matchLabels:
      app: nc-compute-lite
  template:
    metadata:
      labels:
        app: nc-compute-lite
    spec:
      containers:
        - name: nc-compute-lite
          image: nocodb/nc-compute-lite:latest
          securityContext:
            privileged: true
          envFrom:
            - secretRef:
                name: nc-compute-lite
          ports:
            - containerPort: 8430
            - containerPort: 8431
          readinessProbe:
            httpGet:
              path: /health
              port: 8430
          resources:
            requests:
              cpu: '4'
              memory: 8Gi
          volumeMounts:
            - name: docker
              mountPath: /var/lib/docker
      volumes:
        - name: docker
          persistentVolumeClaim:
            claimName: nc-compute-lite
---
apiVersion: v1
kind: Service
metadata:
  name: nc-compute-lite
spec:
  selector:
    app: nc-compute-lite
  ports:
    - name: api
      port: 8430
    - name: proxy
      port: 8431
```

On NocoDB's Deployment (in the same namespace):

```yaml
env:
  - name: NC_COMPUTE_LITE_URL
    value: http://nc-compute-lite:8430
  - name: NC_COMPUTE_LITE_KEY
    valueFrom:
      secretKeyRef:
        name: nc-compute-lite
        key: NC_COMPUTE_LITE_KEY
  - name: NC_COMPUTE_LITE_DOMAIN
    value: sandbox.example.com:8431   # *.sandbox.example.com → the nc-compute-lite Service IP
```

Size `resources` and the volume for how many sandboxes run at once (section 1).
Pods' network policies apply to lite like any pod; NocoDB must reach it on 8430
and 8431.

## 5. NocoDB settings

| Setting | Example | |
|---|---|---|
| `NC_COMPUTE_LITE_URL` | `http://compute-lite:8430` | lite's API, as NocoDB reaches it |
| `NC_COMPUTE_LITE_KEY` | `openssl rand -hex 24` | the same key lite has, 32+ characters |
| `NC_COMPUTE_LITE_DOMAIN` | `sandbox.example.com:8431` | `*.<domain>` resolves to lite from NocoDB; with the proxy port unless TLS fronts it on 443 |
| `NC_COMPUTE_LITE_TLS` | `true` | only behind a TLS proxy |

All three of URL, key and domain must be set, on an Enterprise license. Then
NocoDB uses lite for every sandbox, ahead of any other compute. NocoDB's
startup log then lists `Compute providers: lite, …`.

**TLS (optional):** put a reverse proxy (Caddy, nginx, Traefik) in front of
port 8431 with a wildcard certificate for the domain, forwarding HTTP and
WebSocket with the `Host` header intact. Then set `NC_COMPUTE_LITE_DOMAIN`
without the port and `NC_COMPUTE_LITE_TLS=true`.

**Check it works:** run a script from a workflow or a button, or ask the AI
chat to "run 1 + 1 in Python". The first run of each kind pulls its image
(section 6), so it can take a few minutes.

## 6. Sandbox images

Each NocoDB release pins its sandbox images by digest, so a NocoDB version
always runs the exact images it was released and tested with:
`nocodb/nc-chat-template`, `nc-script-template`, `nc-app-builder`,
`nc-app-runtime`. They are multi-platform (amd64 and arm64); Docker pulls your
host's. Lite pulls each on first use.

**Pull ahead of time** (avoids a slow first run): in embedded mode, pull inside
lite's engine. The tags are in NocoDB's release notes, or run each kind once.

```bash
docker compose exec compute-lite docker pull nocodb/nc-chat-template:<tag>
kubectl exec deploy/nc-compute-lite -- docker pull nocodb/nc-chat-template:<tag>
```

**Private registry or air-gapped:** mirror the images and point NocoDB at them,
one setting per workload: `NC_COMPUTE_LITE_IMAGE_CHAT`,
`NC_COMPUTE_LITE_IMAGE_SCRIPT`, `NC_COMPUTE_LITE_IMAGE_APP_BUILDER`,
`NC_COMPUTE_LITE_IMAGE_APP_RUNTIME`. Air-gapped, load them into lite's engine:

```bash
docker save nocodb/nc-chat-template:<tag> | docker compose exec -T compute-lite docker load
```

## 7. Security

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
- **Host mode needs the same rules on the host**, since lite doesn't own that
  engine. As root, after lite has started once (it creates its networks):

  ```bash
  for net in nc-compute-lite nc-compute-lite-internal; do
    subnet=$(docker network inspect -f '{{(index .IPAM.Config 0).Subnet}}' $net)
    # Traffic Docker forwards to other networks: your LAN, other containers, metadata.
    for dst in 10.0.0.0/8 172.16.0.0/12 192.168.0.0/16 100.64.0.0/10 169.254.0.0/16; do
      iptables -I DOCKER-USER -s "$subnet" -d "$dst" -j DROP
    done
    iptables -I DOCKER-USER -s "$subnet" -m conntrack --ctstate ESTABLISHED,RELATED -j RETURN
    # Traffic to the host itself (via the bridge gateway): a database or sshd on the host.
    iptables -I INPUT -s "$subnet" -m conntrack ! --ctstate ESTABLISHED,RELATED -j DROP
  done
  ```

  Make them persistent with your distribution's iptables tooling, and re-run
  this if you recreate lite's networks.
- App actions run with no internet access at all.

## 8. Lite settings

| Setting | Default | |
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

## 9. Operating it

**Upgrade lite:** pull the new image and recreate it (`docker compose pull
compute-lite && docker compose up -d compute-lite`, or roll the Deployment). In
embedded mode running sandboxes are stopped, and chat sandboxes resume on next
use.

Sandbox images upgrade with NocoDB: a new NocoDB version pins new digests and
lite pulls them on next use. Old images can be pruned with
`docker image prune -a` inside lite (embedded).

**Logs:** lite's container logs, one JSON line per event or error.

**Backups:** nothing to back up. Sandboxes are disposable; chat files that
matter are attached to the chat in NocoDB's storage.

## 10. Troubleshooting

| Symptom | Likely cause / fix |
|---|---|
| Sandboxes never used; NocoDB runs code elsewhere or not at all | not an Enterprise license, or one of URL, key and domain is unset |
| "The machine could not be woken" / scripts fail at once | NocoDB can't reach `NC_COMPUTE_LITE_URL`, or the key differs; `curl <url>/health` from the NocoDB container |
| "The compute agent at `<port>-<id>.<domain>` could not be reached" | `*.<domain>` doesn't resolve to lite from NocoDB, or the `:8431` port is missing or firewalled |
| "Too many machines are running" | raise `NC_COMPUTE_LITE_MAX_SANDBOXES` or add capacity |
| First run very slow | the image is being pulled; pull ahead of time (section 6) |
| `image … is built for amd64; this Docker host is arm64` | an image override points at a single-platform build; use the published images or build for your platform |
| Embedded mode won't start: "embedded Docker engine did not start" | run it privileged, or switch to host mode |
| Lite won't start: "could not install the sandbox egress rule" | the container has no iptables access; run it privileged |
| 403 "not reachable from a sandbox" from NocoDB | NocoDB's network overlaps lite's sandbox range; set `NC_COMPUTE_LITE_ADDRESS_POOL` to a free range and recreate lite's volume |
| License activation fails with `fetch failed` though the server is reachable | Node gives up on slow IPv4 connects on some IPv6-enabled networks; set `NODE_OPTIONS=--network-family-autoselection-attempt-timeout=3000` on NocoDB |

## How images reach you (for maintainers)

All automatic:

1. A change to a template merges into `nocodb/nc-e2b-template`. Its CI builds
   the E2B template and the Docker image for each platform, merges them into one
   multi-platform image, pushes it to Docker Hub, and opens a PR on nocohub
   pinning the new E2B id and Docker digest in `templates.ts`.
2. That PR merges; the next NocoDB release ships the new pins.
3. A change to `packages/nc-compute-lite` merging into nocohub `develop` builds
   and pushes `nocodb/nc-compute-lite:<sha>` and `:latest` for amd64 and arm64.
