# Enterprise Vaults — integration credentials from a customer-owned secrets manager

**Date:** 2026-09-21
**Status:** Implemented on `feat/enterprise-vaults` (AWS driver); four providers deferred
**Scope:** EE only (`ee/`). CE is unchanged by construction — see [CE/EE split](#ceee-split).

## Problem

Every integration credential lives in `nc_integrations_v2.config`, AES-encrypted with
`NC_CONNECTION_ENCRYPT_KEY` (`src/utils/encryptDecrypt.ts`). For enterprise buyers that is a
blocker: their database passwords must stay in the vault their security team already runs, with
rotation and audit owned there, and NocoDB holding only a pointer.

The ask is per-field: a Postgres connection should keep `host` and `port` as plain config and pull
only `user` and `password` from the customer's vault.

## Prior art

Two products ship this feature for the same job — a SaaS admin UI configuring data-source
credentials. Both were studied from primary sources (n8n from its source at three release tags,
Retool from its docs, reachable only over DoH).

| | **Retool** | **n8n** | **Ours** |
|---|---|---|---|
| Syntax | `{{ secrets.name.key }}` | `={{ $secrets.vault.name }}` | `{{ secrets.alias.name.key }}` |
| Store identifier | **optional**, mutable default | required (since 2.10.0) | **required** |
| JSON sub-keys | yes, arbitrary depth | **no — plaintext only** | yes, arbitrary depth |
| Mid-string | undocumented | yes | **no** |
| Resolution scope | server-side only | credential fields only | connection layer only |
| Caching | per-reference, TTL 5 min | whole vault, 5 min poll | per-reference, TTL 5 min |
| AWS auth | **ambient IAM only** | IAM user keys, or SDK chain | AssumeRole via OIDC |
| Azure Key Vault | not supported | supported | deferred |
| Gating | Enterprise, **self-hosted only** | Enterprise | Enterprise |

Wider survey (Kong, Grafana, Airbyte, Databricks, GitLab, Harness, Confluent, Postman,
CloudFormation, External Secrets Operator) informed the rules below. Two findings carried the most
weight:

- **Brace-delimited templates dominate where a human types the reference into an admin form** —
  5 of the 6 such products. Structured objects dominate where the reference lives in a YAML file.
- **Whole-field substitution is near-unanimous.** Kong, Databricks and dbt each forbid mid-string
  interpolation explicitly and in print. Only config-file expanders (Grafana, Vault Agent) allow it.

## Decisions

**Per-field references, not a whole-config blob.** Non-secret fields stay in NocoDB.

**Retool's syntax, with three deliberate divergences**, each backed by a documented failure in the
product we are copying:

1. **The vault alias is mandatory.** Retool made it optional with a mutable default and now
   publishes a caution that changing the default silently re-points every unqualified reference.
   It also makes `secrets['a']['b']` genuinely ambiguous between *(vault, secret)* and
   *(secret, key)*. n8n migrated from a fixed provider id to a required alias for the same reason.
2. **JSON sub-keys are supported.** n8n's providers return raw strings, so an AWS RDS-managed
   secret (`{"username":…,"password":…}`) is unusable without hand-splitting it into two secrets.
   Three enterprise orgs have that filed against n8n as an upgrade blocker.
3. **A reference must be the whole field value.** Mid-string makes redaction, validation and
   "is this field vault-backed?" unanswerable.

**Reserved aliases.** A vault cannot be named `aws`, `vault`, `secrets`, … — Kong protects its
built-in backend names the same way (`not_one_of = VAULTS`) so a customer-named store can never
shadow one.

**AWS first.** All five providers from the design appear in the picker; only AWS is selectable.

**Database integrations only.** Auth/AI integrations need refreshed OAuth tokens written *back*
into the customer's vault, which is usually read-only to us. Separate problem.

## Plan gating — what this feature changes in billing

One new plan feature flag, and the plan definitions for both Cloud and On-Prem. Nothing else in the
payment system changes: no new limit type, no seat impact, no Stripe product.

`PlanFeatureTypes.FEATURE_ENTERPRISE_VAULTS = 'feature_enterprise_vaults'`, with the upgrade
message *"to keep integration credentials in your own secrets manager."*

Cloud and On-Prem plan definitions are separate objects and are **not** inherited from one another,
so the flag is set in both — and the override direction is opposite in each:

```
CLOUD  (base default: every feature ENABLED — list `false` to disable)
  Free / Plus / Business / Scale   feature_enterprise_vaults: false
  Enterprise                       (unlisted -> enabled)

ON-PREM  (Free base default: every feature DISABLED — list `true` to enable)
  Free                             (unlisted -> disabled)
  Self-hosted Business / Scale     feature_enterprise_vaults: false
  Self-hosted Enterprise           (unlisted -> enabled)
```

That is the tier Retool and n8n both charge for it at — neither ships external secret stores below
Enterprise.

**Backend enforcement is `checkForFeature()` in the service, deliberately not `@License`.** That
decorator is a NestJS *controller* decorator, and the vault endpoints are internal-API operations
dispatched by an `operation` query parameter through one shared controller, which a controller-level
decorator cannot see. The service-level check covers the direct HTTP path, the batch envelope and
any future non-HTTP caller, and resolves on both deployments — Cloud from
`workspace.payment.plan.meta`, On-Prem from `getOnPremPlan()`.

**Frontend gating shows the feature locked, never hidden** — `blockEnterpriseVaults` in
`useEeConfig` (CE stub always `true`). The banner renders for any EE build with a
`PaymentUpgradeBadge` reading *Enterprise* when the plan does not grant it, and the CTA routes to
pricing rather than opening the wizard. Only CE hides it, via `isEeUI`. Verified live: on a Free-plan
dev workspace the badge renders and the CTA routes to pricing.

**ACL is a separate axis.** The plan decides whether the workspace *has* the feature; ACL decides
*who* may use it. The seven vault operations are creator/owner only — in `permissionScopes.workspace`
and in no role `include` map, which is how creator and owner inherit them while viewer, commenter and
editor do not. `integrationCreate` is granted by the same mechanism. Deliberately stricter than
integrations, though: `integrationList` is viewer+, `vaultList` is creator+, because even the
metadata names the workspace's secrets infrastructure.

## Design

### Reference syntax

```
{{ secrets.awsProd.dbPassword }}                   alias=awsProd secret=dbPassword path=[]
{{ secrets.awsProd.dbCreds.password }}             path=['password']
{{ secrets.awsProd['prod/db/creds'].password }}    bracket form for real AWS names
{{ secrets['awsProd']['rds!db-92c0']['password'] }}
```

- `secrets` — fixed namespace.
- `alias` — the vault's `title`. Unique per workspace, immutable, `^[a-zA-Z][a-zA-Z0-9]*$`.
  Constrained to a bare identifier so `secrets.myVault` always parses in dot form; the bracket
  escape hatch then only ever has to cover *secret* names.
- `secret` — provider-native identifier. Routinely contains `/`, `-`, `!`, so the bracket form is
  the common case, not the exception. Retool's own "Reference" column emits brackets for this
  reason, and ours does too.
- Remaining segments — the JSON key path. Empty means the whole secret, which must then be a
  string.

Stored verbatim in `nc_integrations_v2.config`, so it is inspectable, diffable and copy-pasteable.

### One parser, in the SDK

`packages/nocodb-sdk/src/lib/vault/index.ts` is the single definition, imported by backend
resolver, backend validation and the frontend picker alike:

```ts
parseSecretRef(value): ParsedSecretRef | null   // { alias, secret, path }; whole-field only
buildSecretRef({alias, secret, path?}): string  // emits bracket form where needed
mentionsSecretsNamespace(value): boolean        // permissive typo detector
isValidVaultAlias(alias): boolean               // pattern + reserved names
```

This is not incidental. n8n shipped **three divergent detectors** for the same syntax — backend
validation, frontend validation and the test button — and a mixed dot/bracket reference matched
none of them, breaking saving for four months.

### Data model

```
nc_vaults
  id            fk_workspace_id    title (= alias, unique per workspace)
  provider      config (encrypted auth params — never leaves the backend)
  is_encrypted  meta    created_by    timestamps
  unique (fk_workspace_id, title)
```

`config` holds only what is needed to *authenticate to the provider* (role ARN, region, vault
address). It never reaches a client, not even a workspace owner: `Vault.toPublic()` is what every
API path returns.

### Resolution seam

`Source.getConfig()` pulls the integration config by SQL JOIN (`integration_config`) and
deep-merges it — it never goes through `Integration.getConfig()`, and it is **synchronous**. The
only workable hook is the async `Source.getConnectionConfig()`, in the EE override:

```ts
public async getConnectionConfig(): Promise<any> {
  // ... existing is_meta / is_local / db-server branches unchanged ...
  const config = this.getConfig();
  return resolveVaultRefs(config);
}
```

The resolver deep-walks for string values that parse, groups by `(alias, secret)` so a credential
reading `username` and `password` from one secret costs **one** provider call, and splices values
into a deep copy. A missing vault, absent key or provider error **throws** — never a stale,
partial or empty credential.

**Cache: an in-process `Map` with a 5-minute TTL, deliberately not `NocoCache`.** Resolved values
are plaintext secrets and NocoCache is Redis-backed, usually a managed service. Module-level rather
than per-instance so the Nest-injected resolver and the singleton share one cache — otherwise
`invalidateVault` would clear half of it.

We do **not** copy n8n's eager whole-vault cache. Their 5-minute poll of every secret is the root
of most of their open operational bugs: one bad secret fails the entire vault reload, an errored
provider never recovers until restart while the UI reports success, and an unreachable vault pinned
`/healthz/readiness` at 503.

### AWS authentication

`AssumeRoleWithWebIdentity` via a **per-workspace OIDC issuer**. Two things forced this:

- **`ExternalId` is not a parameter of `AssumeRoleWithWebIdentity`** — it exists only on plain
  `AssumeRole`. Isolation comes entirely from the `:aud` and `:sub` conditions in the customer's
  trust policy.
- AWS now **rejects role policies for recognised *shared* OIDC issuers** that do not evaluate a
  tenancy claim. Google's workload-identity docs give SaaS vendors the same instruction. A single
  issuer across all tenants lets one customer's workload assume another's role.

`sub` is an opaque workspace id, never a user email — AWS writes it into the customer's CloudTrail.

Retool's model (ambient IAM, no credential fields at all) is unavailable to us: it works only
because Retool ships this feature self-hosted, inside the customer's own AWS account.

### CE/EE split

The resolution seam is the EE `Source` override, so CE needs no change and keeps working. The
`Vault` model, resolver, drivers, service and API ops are EE-only. Frontend components follow the
CE-stub / EE-overlay convention (`<NcSpanHidden />` stubs with identical props).

## Failure modes

**A typo silently becomes a plaintext password.** The one real cost of a string encoding. If a user
writes `{{ secret.v.k }}` or drops a brace, a naive implementation stores that literal as the
credential. Databricks documents exactly this: *"Otherwise, the environment variable is considered
a plain text environment variable."* Mitigated by `mentionsSecretsNamespace()` — a value that
mentions the namespace but does not parse is **rejected on save**, not stored.

**A reference outliving its vault.** Delete is refused while any integration still references the
vault. The scan decrypts each Database integration rather than using `Integration.list`, which
hides other users' private integrations and would let a referenced vault be deleted out from under
one. A row that fails to decrypt counts as a reference — fail closed.

**An alias changing under stored references.** Aliases are immutable; update rejects a `title`
change.

**A resolved secret leaking into storage.** The highest-probability bug in this design and a silent
one: any read-modify-write path that reads the *resolved* config and writes it back materializes
the plaintext. Resolution happens only in the transient connection object, and a round-trip test
pins it.

**A resolved secret leaking into logs.** Never logged. Provider errors are logged with detail and
surfaced to users sanitized.

## Testing

Unit (`tests/unit/rest/tests/ee/vaults.test.ts`), with the provider stubbed into the driver
registry so the real resolution path runs with no live cloud:

- CRUD; `config` absent from every response; ACL (creator/owner yes, viewer 403); plan gating.
- Alias rules — pattern, reserved names, uniqueness, immutability.
- Batching: two fields, one secret, **one** `getSecret` call.
- Every failure mode throws rather than degrading.
- TTL cache hit avoids a second call; `invalidateVault` forces a refetch; no cross-tenant leak.
- **The round-trip regression**: a reference written, read back and re-saved is still a reference.
- **The typo guard**: a value mentioning the namespace but not parsing is rejected, not stored.
- `Source.getConnectionConfig()` resolves while `getConfig()` still shows the reference.
- Delete guard; unavailable provider rejected.

Playwright (`tests/ee/vaults.spec.ts` + a new `IntegrationsPage` page object): banner for a
creator, wizard across all three steps with only AWS selectable, SecretField on a Postgres form.

## Out of scope — tracked follow-up

- **OIDC issuer endpoint** — discovery document + JWKS per workspace. `getWorkspaceOidcToken`
  mints the token and throws without `NC_VAULT_OIDC_*` rather than falling back to ambient
  credentials; nothing serves the issuer yet.
- **HashiCorp Vault** — detect KV v1 vs v2 via `sys/mounts` rather than asking; the namespace
  header is required for Enterprise/HCP.
- **Azure Key Vault — blocked.** Azure caps federated identity credentials at **20 per app
  registration**, with no wildcards. One credential per customer stops scaling at 20 customers.
  Resolve before scoping: a shared subject (weaker isolation), several app registrations, or the
  Flexible FIC preview.
- **Google Secret Manager** — workload identity federation; verify the CRC32C on read.
- **CyberArk Conjur** — no official Node SDK; batch read via `?variable_ids=`.
- **Auth and AI integrations** — needs OAuth token write-back into a customer vault.
- **`REFERENCE SECRET` vs `READ SECRET` privileges.** Databricks Unity Catalog is the only
  surveyed product that separates "may point a field at this secret" from "may see its value".
  Retool openly concedes the gap: *"Any user that can configure resources can use secrets in
  resources."*
- **Audit rows for `AppEvents.VAULT_*`** — needs `AuditV1OperationTypes` entries and listener cases.
- **References inside `IntegrationEnvConfig` per-environment overrides** are not covered by the
  delete guard.
