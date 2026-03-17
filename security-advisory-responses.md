# Security Advisory Responses

## GHSA-2c5x-4jgf-88mj — SSRF Protection Bypass in Notification Webhook Plugins (Slack, Discord, Mattermost, Teams)

**Reported Severity:** High | **Our Assessment:** Medium

Thank you for reporting this. The misplaced `httpAgent`/`httpsAgent` arguments in the four notification plugins (Slack, Discord, Mattermost, Teams) are confirmed and have been fixed — the agents are now correctly passed in the axios config (3rd argument) instead of the request body.

However, we'd like to clarify the severity assessment:

**Privileges required are higher than reported.** The advisory states "Editor+" role can exploit this. This is incorrect. Webhook (hook) creation requires **Creator or Owner** base roles — Editors cannot create or configure hooks. These are high-trust administrative roles with broad existing access to the base (schema management, user invitations, data deletion, etc.).

**Impact is limited to blind SSRF.** The request is a POST with a JSON body containing the notification text and serialized agent objects. The response is not returned to the caller (hook execution is async/fire-and-forget). Most internal services would reject this malformed POST body. Additionally, cloud metadata endpoints using IMDSv2 (AWS default since 2024) require a PUT with specific headers, which this POST-based SSRF cannot satisfy.

Given these factors, we assess the severity as **Medium**, not High:
- **Privileges required: High** (Creator/Owner, not Low/Editor)
- **Scope: Unchanged** (blind SSRF, no response exfiltration path)

We appreciate the detailed report and the clear identification of the misplaced arguments.

---

## GHSA-fr59-j627-mq4v — Hardcoded Encryption Key Exposes Legacy Database Connection Credentials

**Reported Severity:** High | **Our Assessment:** Informational

Thank you for the report. We've investigated and this is **not exploitable** in practice.

**The `nc_projects` table no longer exists.** Migration `nc_012_cloud_cleanup` drops the `nc_projects` table during the v1 migration chain on all deployments. Any NocoDB instance that has been through standard migrations does not have this table.

**The method already guards against a missing table.** `legacyProjectList()` checks `hasTable('nc_projects')` and returns `[]` if absent — no decryption ever executes on current installations.

**The decrypted data is never exposed externally.** The only caller is `init-meta-service.provider.ts` during startup, where it checks `length` to block upgrades from very old versions (pre-0.207.3). The decrypted config is never returned via any API endpoint.

**The attack prerequisite is redundant.** The advisory requires "read access to the NocoDB metadata database" — an attacker with direct database access already has access to all data NocoDB manages, making credential decryption moot.

We've cleaned up this stale code: removed the hardcoded key, the `CryptoJS` import, and the unnecessary config decryption. The method now only checks for table existence (its actual purpose).

---

## GHSA-m5qg-rvjq-727p — OAuth Token Scope Not Enforced at ACL Layer Allows Scope Escalation

**Reported Severity:** High | **Our Assessment:** Low (accepted)

Thank you for the report. We accept this as a **Low** severity defense-in-depth improvement.

**OAuth tokens cannot be created in the open-source edition.** This advisory is filed against `nocodb` (npm) — the open-source CE package. OAuth token creation is an enterprise-only feature, so this is not exploitable in the affected package.

**Resource scoping is already enforced at the consumer layer.** The only consumer of OAuth tokens is the MCP controller, which independently enforces scoping — it extracts `workspace_id` and `base_id` from the token's `granted_resources`, rejects requests if either is missing, and re-fetches user roles scoped to that specific base.

**No privilege escalation occurs.** OAuth tokens inherit the user's existing roles. The token cannot access anything the user couldn't already access via their normal session. Only one scope (`mcp`) exists — there are no other scopes to escalate to.

We acknowledge that `oauth_scope` is not enforced at the ACL middleware layer, and the `granted_resources` check in the strategy is conditional on `req.context` being populated. While the MCP controller mitigates this today, we will add scope enforcement at the ACL layer as a hardening measure for future OAuth scope types.

**Severity: Low** (not High) — no exploitable impact in CE, defense-in-depth gap in EE with existing mitigations.

---

## GHSA-w6v8-rmp7-9pc3 — Weak Cryptographic Key Derivation (EvpKDF/MD5) for Database Credential Encryption

**Reported Severity:** Moderate | **Our Assessment:** Informational — Closed

Thank you for the report. We're closing this as **Informational — not a vulnerability**.

The attack prerequisite — read access to the NocoDB metadata database — defeats the threat model. An attacker with that level of access already has access to all data NocoDB manages. The encrypted configs in `nc_sources`/`nc_integrations` protect external data source credentials, but the security boundary is database access control, not the encryption layer.

Additionally, encryption is **opt-in** — when `NC_CONNECTION_ENCRYPT_KEY` is not set (the default), configs are stored in plaintext. The encryption exists as defense-in-depth for operators who choose to enable it, and the key's security is determined by the operator's choice of key, not the KDF iteration count.

The PoC's dictionary attack assumes a human-chosen weak key, but `NC_CONNECTION_ENCRYPT_KEY` is a deployment-time environment variable — not a user-facing password. Properly configured deployments use high-entropy keys where KDF strength is immaterial.

We may upgrade the KDF in a future release as a hardening measure, but this does not meet the threshold of a security vulnerability.

---

## GHSA-29jv-wh64-2ccj — Empty Token Version in AuthService Registration Path Defeats JWT Revocation

**Reported Severity:** Moderate | **Our Assessment:** Not a vulnerability

Thank you for the report. This is **not a vulnerability** — the identified code is dead and unreachable.

**`AuthService.registerNewUserIfAllowed()` has zero callers.** All user registration paths — signup, Google OAuth, invites — go through `UsersService.registerNewUserIfAllowed()` (`users.service.ts:131`), which correctly generates a random `token_version` via `randomTokenString()`. The `AuthService` version is legacy dead code that was never wired into any code path.

**Even hypothetically, the PoC's conclusion is wrong.** The advisory claims "old token may STILL work" after password change because `'' === ''`. However, the JWT strategy (`jwt.strategy.ts:29-34`) checks `!user.token_version` *before* the comparison. Since `''` is falsy in JavaScript, `!'' === true`, and the check throws `Token Expired. Please login again.` — tokens would be **rejected**, not accepted. Additionally, the sign-in flow (`users.service.ts:684-690`) auto-corrects empty `token_version` to a random value before any JWT is ever issued.

We've removed this dead method as a code hygiene cleanup, but there was no security impact.

---

## GHSA-f74w-272x-mqcv — Refresh Token Cookie Set Without `Secure` and `SameSite` Flags

**Reported Severity:** Moderate | **Our Assessment:** Moderate (accepted)

Thank you for the report. This is a valid finding — confirmed and fixed.

The `setTokenCookie` function (used for the `refresh_token` cookie) was missing `secure` and `sameSite` flags, while `setAuthCookie` (used for the `nc_token` cookie) in the same file already had both. This was an oversight when `setAuthCookie` was added with the correct flags but `setTokenCookie` was not updated to match.

We've aligned `setTokenCookie` with `setAuthCookie` by adding:
- `sameSite: 'lax'` — prevents the cookie from being sent with cross-site requests
- `secure: true` when `NC_PUBLIC_URL` starts with `https` — prevents transmission over plaintext HTTP

We agree with the **Moderate** severity assessment. While practical exploitation requires either a network position (for HTTP interception) or chaining with another vulnerability like XSS (for the CSRF vector), these are standard cookie hardening flags that should have been present.

---

## GHSA-99vc-2jx2-688p — Missing File Size Enforcement in Upload-by-URL Allows Denial of Service via Disk Exhaustion

**Reported Severity:** Moderate | **Our Assessment:** Moderate (accepted)

Thank you for the report. This is a valid finding — confirmed and fixed.

The v1/v2 `uploadViaURL` path (`POST /api/v1/db/storage/upload-by-url`, `POST /api/v2/storage/upload-by-url`) retrieved `content-length` from the HEAD response but never validated it against `NC_ATTACHMENT_FIELD_SIZE` (default 20 MB). The v3 API already enforced this limit correctly.

We've added the missing size check after the HEAD request, rejecting files that exceed `NC_ATTACHMENT_FIELD_SIZE` before the download begins. This aligns the v1/v2 behavior with the v3 API.

We agree with the **Moderate** severity. The attack requires Editor-level authentication and the impact is limited to disk exhaustion (availability), not data compromise.

---

## GHSA-qx5v-rp3h-wh82 — NocoDB Shared Base Password Bypass

**Reported Severity:** High | **Our Assessment:** Documentation bug — Closed

Thank you for the report. We're closing this as a **documentation bug**, not a security vulnerability.

**Password protection was never implemented for shared bases.** The `password` field in the `SharedBaseReq` schema is a swagger documentation error — this feature was never built or intended for shared bases. The shared base UI has no password option; it only offers an enable/disable toggle and role selection. Password protection exists for **shared views** (individual table views), which is a separate feature with full enforcement.

**Shared bases use "anyone with the link" access by design.** The UUID is the access control — shared base UUIDs are v4 (122 bits of randomness), making enumeration infeasible. This is the intended design, similar to link-based sharing in other collaboration tools.

We will fix the swagger schema to remove the erroneous `password` field from `SharedBaseReq` and credit you for identifying the documentation discrepancy.
