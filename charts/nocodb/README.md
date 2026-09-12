# NocoDB Helm Chart

Production-ready Helm chart for [NocoDB](https://nocodb.com) on Kubernetes, designed for
externally-managed Postgres and Redis. Object storage for attachments is configured from the
NocoDB admin panel after install.

## TL;DR

```bash
helm install nocodb oci://ghcr.io/nocodb/charts/nocodb --version 1.0.0 \
  --set externalDatabase.existingSecret=nocodb-secrets \
  --set externalRedis.existingSecret=nocodb-secrets
```

## Prerequisites

- Kubernetes 1.23+
- Helm 3.8+ (OCI support)
- External PostgreSQL and Redis (and an S3-compatible bucket for attachments, configured in-app after install)
- An ingress controller (and optionally cert-manager) for external access

## Secret key contract

Create one Secret and reference it from each `*.existingSecret`:

| Key | Purpose | Example |
|---|---|---|
| `DATABASE_URL` | Postgres URL | `postgresql://user:pass@host:5432/nocodb?sslmode=require` |
| `NC_REDIS_URL` | Redis URL | `rediss://:pass@host:6379` |
| `NC_AUTH_JWT_SECRET` | JWT secret (optional; auto-generated) | random ≥32 chars |
| `NC_CONNECTION_ENCRYPT_KEY` | Datasource encryption key (optional; auto-generated, never rotate) | random ≥32 chars |

<!-- markdownlint-disable -->

## Parameters

### Common

| Name | Description | Value |
|------|-------------|-------|
| `nameOverride` | Override the chart name | `""` |
| `fullnameOverride` | Override the fully qualified release name | `""` |
| `commonLabels` | Labels added to all resources | `{}` |
| `commonAnnotations` | Annotations added to all resources | `{}` |

### Service account

| Name | Description | Value |
|------|-------------|-------|
| `serviceAccount.create` | Create a ServiceAccount | `true` |
| `serviceAccount.name` | Name of the ServiceAccount (defaults to fullname) | `""` |
| `serviceAccount.annotations` | Annotations for the ServiceAccount (e.g. IRSA / Workload Identity) | `{}` |
| `serviceAccount.automountServiceAccountToken` | Auto-mount the SA token | `false` |

### Global

| Name | Description | Value |
|------|-------------|-------|
| `global.imageRegistry` | Global image registry override | `""` |
| `global.imagePullSecrets` | Global image pull secrets | `[]` |
| `global.storageClass` | Global storage class for PVCs | `""` |

### Image

| Name | Description | Value |
|------|-------------|-------|
| `image.registry` | NocoDB image registry | `docker.io` |
| `image.repository` | NocoDB image repository | `nocodb/nocodb` |
| `image.digest` | Image digest (takes precedence over tag), e.g. sha256:... | `""` |
| `image.pullPolicy` | Image pull policy | `IfNotPresent` |
| `image.pullSecrets` | Image pull secrets | `[]` |

### App workload

| Name | Description | Value |
|------|-------------|-------|
| `replicaCount` | Number of app replicas (>=2 requires Redis) | `2` |
| `updateStrategy` | Deployment update strategy (ordered rollout for migration safety) | `RollingUpdate maxSurge:1 maxUnavailable:0` |
| `resources` | App container resources (2Gi memory recommended, 1Gi minimum) | `requests: {cpu: "1", memory: 2Gi}` |
| `podAnnotations` | Extra annotations for app pods | `{}` |
| `podLabels` | Extra labels for app pods | `{}` |
| `podSecurityContext` | App pod security context | `fsGroup: 1000` |
| `containerSecurityContext` | App container security context | See values.yaml |
| `livenessProbe` | App liveness probe (httpGet /api/v1/health) | See values.yaml |
| `readinessProbe` | App readiness probe | See values.yaml |
| `startupProbe` | App startup probe (generous to cover first-boot migrations) | See values.yaml |
| `customLivenessProbe` | Replaces the generated liveness probe when set | `{}` |
| `customReadinessProbe` | Replaces the generated readiness probe when set | `{}` |
| `customStartupProbe` | Replaces the generated startup probe when set | `{}` |
| `lifecycle` | Container lifecycle hooks (default preStop drains the LB) | See values.yaml |
| `terminationGracePeriodSeconds` | Grace period for in-flight request drain | `60` |

### App config (non-secret)

| Name | Description | Value |
|------|-------------|-------|
| `nocodb.publicUrl` | NC_SITE_URL. If empty, derived from the first ingress host when TLS is set | `""` |
| `nocodb.dashboardUrl` | NC_DASHBOARD_URL | `""` |
| `nocodb.disableMux` | Set NC_DISABLE_MUX=true (recommended for self-hosted) | `true` |
| `nocodb.disableTelemetry` | Set NC_DISABLE_TELE=true | `false` |
| `nocodb.licenseKey` | NC_LICENSE_KEY (enterprise) | `""` |
| `nocodb.extraEnvVars` | Extra raw env vars for the app (list of name/value or valueFrom) | `[]` |

### Worker workload

| Name | Description | Value |
|------|-------------|-------|
| `worker.enabled` | Deploy a dedicated background worker (requires Redis) | `true` |
| `worker.replicaCount` | Worker replicas | `2` |
| `worker.concurrency` | NC_WORKER_CONCURRENCY (empty = NocoDB default) | `""` |
| `worker.resources` | Worker container resources (2Gi memory recommended, 1Gi minimum) | `requests: {cpu: "1", memory: 2Gi}` |
| `worker.podAnnotations` | Extra annotations for worker pods | `{}` |
| `worker.nodeSelector` | Worker node selector | `{}` |
| `worker.tolerations` | Worker tolerations | `[]` |
| `worker.affinity` | Worker affinity (overrides the default anti-affinity preset) | `{}` |
| `worker.terminationGracePeriodSeconds` | Grace period for the worker to drain in-flight Bull jobs on shutdown | `120` |
| `worker.autoscaling.enabled` | Enable HPA for the worker | `false` |
| `worker.autoscaling.minReplicas` | Minimum worker replicas | `2` |
| `worker.autoscaling.maxReplicas` | Maximum worker replicas | `5` |
| `worker.autoscaling.targetCPU` | Target CPU utilisation percentage for worker HPA | `80` |
| `worker.autoscaling.targetMemory` | Target memory utilisation percentage for worker HPA (empty to disable) | `""` |
| `worker.extraEnvVars` | Extra raw env vars for the worker | `[]` |

### External Postgres (required)

| Name | Description | Value |
|------|-------------|-------|
| `externalDatabase.host` | Postgres host (eval/inline path) | `""` |
| `externalDatabase.port` | Postgres port | `5432` |
| `externalDatabase.database` | Database name | `nocodb` |
| `externalDatabase.username` | Database user | `nocodb` |
| `externalDatabase.password` | Database password (eval only; use existingSecret in prod) | `""` |
| `externalDatabase.sslMode` | sslmode appended to the assembled URL | `prefer` |
| `externalDatabase.urlEnvVar` | Env var name for the connection URL (DATABASE_URL or NC_DB) | `DATABASE_URL` |
| `externalDatabase.existingSecret` | Secret holding the full connection URL | `""` |
| `externalDatabase.existingSecretUrlKey` | Key in existingSecret holding the URL | `DATABASE_URL` |

### External Redis (required for HA / worker)

| Name | Description | Value |
|------|-------------|-------|
| `externalRedis.host` | Redis host | `""` |
| `externalRedis.port` | Redis port | `6379` |
| `externalRedis.password` | Redis password (eval only) | `""` |
| `externalRedis.tls` | Use rediss:// scheme | `false` |
| `externalRedis.existingSecret` | Secret holding the full NC_REDIS_URL | `""` |
| `externalRedis.existingSecretUrlKey` | Key in existingSecret holding NC_REDIS_URL | `NC_REDIS_URL` |

### SMTP (optional)

| Name | Description | Value |
|------|-------------|-------|
| `smtp.enabled` | Configure SMTP email | `false` |
| `smtp.host` | SMTP host | `""` |
| `smtp.port` | SMTP port | `587` |
| `smtp.from` | From address | `""` |
| `smtp.username` | SMTP username | `""` |
| `smtp.password` | SMTP password (eval only) | `""` |
| `smtp.secure` | NC_SMTP_SECURE | `false` |
| `smtp.existingSecret` | Secret holding the SMTP password | `""` |
| `smtp.passwordKey` | Key in existingSecret for the SMTP password | `NC_SMTP_PASSWORD` |

### SSO (optional)

| Name | Description | Value |
|------|-------------|-------|
| `sso.oidc.enabled` | Enable OIDC (sets NC_SSO=oidc) | `false` |
| `sso.oidc.providerName` | Display name for the OIDC provider | `OpenID Connect` |
| `sso.saml.enabled` | Enable SAML (sets NC_SSO=saml) | `false` |
| `sso.saml.providerName` | Display name for the SAML provider | `SAML` |

### Auth keys

| Name | Description | Value |
|------|-------------|-------|
| `auth.jwtSecret` | NC_AUTH_JWT_SECRET (auto-generated+persisted if empty) | `""` |
| `auth.encryptionKey` | NC_CONNECTION_ENCRYPT_KEY (auto-generated+persisted if empty; never rotated) | `""` |
| `auth.existingSecret` | Secret holding both keys | `""` |
| `auth.jwtSecretKey` | Key in existingSecret for the JWT secret | `NC_AUTH_JWT_SECRET` |
| `auth.encryptionKeyKey` | Key in existingSecret for the encryption key | `NC_CONNECTION_ENCRYPT_KEY` |

### Scaling & scheduling

| Name | Description | Value |
|------|-------------|-------|
| `autoscaling.enabled` | App HPA | `false` |
| `autoscaling.minReplicas` | Minimum app replicas for HPA | `2` |
| `autoscaling.maxReplicas` | Maximum app replicas for HPA | `10` |
| `autoscaling.targetCPU` | Target CPU utilisation percentage for app HPA | `80` |
| `autoscaling.targetMemory` | Target memory utilisation percentage for app HPA (empty to disable) | `""` |
| `pdb.create` | Create PodDisruptionBudgets for the app and worker | `false` |
| `pdb.minAvailable` | Minimum available pods for PDB (integer or percentage) | `1` |
| `pdb.maxUnavailable` | Maximum unavailable pods for PDB (integer or percentage; empty if minAvailable is set) | `""` |
| `podAntiAffinityPreset` | Default app pod anti-affinity (soft\|hard\|"") | `soft` |
| `topologySpreadConstraints` | App topology spread constraints | `[]` |
| `affinity` | App affinity (overrides podAntiAffinityPreset) | `{}` |
| `nodeSelector` | App node selector | `{}` |
| `tolerations` | App tolerations | `[]` |
| `priorityClassName` | App priority class | `""` |

### Networking

| Name | Description | Value |
|------|-------------|-------|
| `service.type` | Service type | `ClusterIP` |
| `service.port` | Service port | `8080` |
| `service.annotations` | Service annotations | `{}` |
| `ingress.enabled` | Create an Ingress | `false` |
| `ingress.className` | Ingress class name | `""` |
| `ingress.annotations` | Ingress annotations (cert-manager cluster-issuer here) | `{}` |
| `ingress.hosts` | Ingress hosts | See values.yaml |
| `ingress.tls` | Ingress TLS entries | `[]` |
| `networkPolicy.enabled` | Create a NetworkPolicy | `false` |
| `networkPolicy.allowExternal` | Allow ingress from anywhere | `true` |
| `networkPolicy.extraIngress` | Extra ingress rules | `[]` |
| `networkPolicy.extraEgress` | Extra egress rules | `[]` |

### Persistence (local attachment storage)

| Name | Description | Value |
|------|-------------|-------|
| `persistence.enabled` | Mount a PVC at /usr/app/data instead of emptyDir | `false` |
| `persistence.storageClass` | StorageClass for the PVC (empty uses cluster default) | `""` |
| `persistence.accessModes` | PVC access modes | `["ReadWriteOnce"]` |
| `persistence.size` | PVC size | `10Gi` |
| `persistence.existingClaim` | Existing PVC name (skips PVC creation) | `""` |

### Observability

| Name | Description | Value |
|------|-------------|-------|
| `monitoring.sentry.enabled` | Set NC_SENTRY_DSN | `false` |
| `monitoring.sentry.dsn` | Sentry DSN (eval; use existingSecret in prod) | `""` |
| `monitoring.sentry.existingSecret` | Secret holding the Sentry DSN | `""` |
| `monitoring.sentry.dsnKey` | Key in existingSecret for the DSN | `NC_SENTRY_DSN` |

### Escape hatches

| Name | Description | Value |
|------|-------------|-------|
| `extraEnvVars` | Extra env vars applied to app and worker | `[]` |
| `extraEnvVarsCM` | Name of a ConfigMap with extra env vars | `""` |
| `extraEnvVarsSecret` | Name of a Secret with extra env vars | `""` |
| `extraVolumes` | Extra volumes | `[]` |
| `extraVolumeMounts` | Extra volume mounts | `[]` |
| `initContainers` | Extra init containers | `[]` |
| `sidecars` | Extra sidecar containers | `[]` |
| `command` | Override container command | `[]` |
| `args` | Override container args | `[]` |
| `lifecycleHooks` | Override container lifecycle hooks (takes precedence over lifecycle) | `{}` |
| `extraDeploy` | Extra raw manifests (tpl-rendered) | `[]` |

<!-- markdownlint-enable -->
