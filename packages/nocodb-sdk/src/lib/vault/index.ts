/**
 * Enterprise Vaults — integration credentials sourced from a workspace's OWN
 * secrets manager.
 *
 * A credential field holds a REFERENCE, never the secret:
 *
 *     {{ secrets.awsProd.dbCreds.password }}
 *     {{ secrets.awsProd['prod/db/creds'].password }}
 *     {{ secrets['awsProd']['prod/db/creds']['password'] }}
 *
 * The value is fetched from the provider at connection time, server-side, and
 * lives only in the transient connection config.
 *
 * The syntax is Retool's, deliberately — it is the shipped convention for this
 * exact feature in a SaaS admin UI. Three places where we diverge, each for a
 * documented reason:
 *
 *  1. The vault alias is MANDATORY. Retool made it optional with a mutable
 *     default and now publishes a caution that changing the default silently
 *     re-points every unqualified reference. n8n migrated to a required alias
 *     for the same reason.
 *  2. Sub-keys into a JSON secret ARE supported. n8n's providers return raw
 *     strings, which makes an AWS RDS-managed secret (`{"username":..,
 *     "password":..}`) unusable without hand-splitting it into two secrets.
 *  3. A reference must be the WHOLE field value. Every product that documents
 *     the question — Kong, Databricks, dbt — forbids mid-string interpolation,
 *     because it makes redaction and "is this field vault-backed?" unanswerable.
 */

/** Secrets providers a workspace can connect. */
export enum VaultProviderType {
  HASHICORP_VAULT = 'hashicorp_vault',
  AWS_SECRETS_MANAGER = 'aws_secrets_manager',
  AZURE_KEY_VAULT = 'azure_key_vault',
  GOOGLE_SECRET_MANAGER = 'google_secret_manager',
  CYBERARK_CONJUR = 'cyberark_conjur',
}

/** The fixed root of every reference. */
export const SECRETS_NAMESPACE = 'secrets';

/**
 * A vault's alias — the first segment of every reference, chosen by the admin
 * who connects it and immutable afterwards (references embed it).
 *
 * Constrained to a bare JS identifier so `secrets.myVault` always parses in dot
 * form; the bracket escape hatch then only ever has to cover SECRET names,
 * which routinely contain `/` and `-`.
 */
export const VAULT_ALIAS_PATTERN = /^[a-zA-Z][a-zA-Z0-9]*$/;

/**
 * Aliases a workspace may not take. Kong reserves its built-in backend names
 * the same way (`not_one_of = VAULTS`) so a customer-named vault can never
 * shadow one and make a reference mean two things.
 */
export const RESERVED_VAULT_ALIASES = [
  'secrets',
  'secret',
  'vault',
  'vaults',
  'aws',
  'azure',
  'gcp',
  'google',
  'hcv',
  'hashicorp',
  'conjur',
  'cyberark',
  'env',
];

export const isValidVaultAlias = (alias: string): boolean =>
  typeof alias === 'string' &&
  VAULT_ALIAS_PATTERN.test(alias) &&
  !RESERVED_VAULT_ALIASES.includes(alias.toLowerCase());

/** Whether a segment can be written in dot form rather than brackets. */
const JS_IDENTIFIER = /^[A-Za-z_$][A-Za-z0-9_$]*$/;

export const isJsIdentifier = (segment: string): boolean =>
  typeof segment === 'string' && JS_IDENTIFIER.test(segment);

/** A parsed reference. */
export interface ParsedSecretRef {
  /** Vault alias — `nc_vaults.title`. */
  alias: string;
  /** Provider-native secret identifier (ARN or name, KV path, secret name). */
  secret: string;
  /**
   * Key path into a JSON secret. Empty means "the whole secret", which must
   * then resolve to a string — Azure Key Vault, Google Secret Manager and
   * Conjur store opaque strings with no sub-key.
   */
  path: string[];
}

/**
 * Permissive detector: does this value MENTION the secrets namespace inside
 * `{{ }}`, whether or not it parses.
 *
 * Save paths use this to reject a malformed reference instead of storing it.
 * Without that check a typo (`{{ secret.v.k }}`, a missing brace) is persisted
 * verbatim as the credential — Databricks documents exactly this failure:
 * "Otherwise, the environment variable is considered a plain text environment
 * variable." A password-shaped typo would land in the meta DB in the clear.
 */
export const mentionsSecretsNamespace = (value: unknown): boolean => {
  if (typeof value !== 'string') return false;

  // Deliberately NOT "a closed {{ … }} containing the word `secrets`". That is
  // blind to the two failures most worth catching — `{{ secret.v.k }}`
  // (singular, so no `secrets`) and `{{ secrets.v.k` (never closed) — which are
  // exactly the typos this guard exists for.
  //
  // The signal is instead: a brace, plus member access on `secret`/`secrets`.
  // A literal password would have to contain both to trip it, and being told to
  // fix a strange-looking password beats silently storing a broken reference as
  // the credential.
  return value.includes('{') && /\bsecrets?\s*[.[]/.test(value);
};

// `.ident` or `['quoted']` / `["quoted"]`, whitespace tolerated around each part.
const ACCESSOR =
  /^\s*(?:\.\s*([A-Za-z_$][A-Za-z0-9_$]*)|\[\s*(['"])((?:(?!\2)[\s\S])*)\2\s*\])/;

/**
 * Parse a field value into a reference, or null when it is not one.
 *
 * Whole-field only: the trimmed value must be exactly one `{{ … }}` block whose
 * contents are `secrets` followed by at least two accessors (alias, secret).
 * Anything further is the JSON key path.
 */
export const parseSecretRef = (value: unknown): ParsedSecretRef | null => {
  if (typeof value !== 'string') return null;

  const trimmed = value.trim();
  if (!trimmed.startsWith('{{') || !trimmed.endsWith('}}')) return null;

  let rest = trimmed.slice(2, -2).trim();

  if (!rest.startsWith(SECRETS_NAMESPACE)) return null;
  rest = rest.slice(SECRETS_NAMESPACE.length);
  // Guard against `secretsFoo.x.y` — the namespace must end at a boundary.
  if (/^[A-Za-z0-9_$]/.test(rest)) return null;

  const segments: string[] = [];
  while (rest.trim().length) {
    const match = ACCESSOR.exec(rest);
    if (!match) return null;
    segments.push(match[1] !== undefined ? match[1] : match[3]);
    rest = rest.slice(match[0].length);
  }

  if (segments.length < 2) return null;

  const [alias, secret, ...path] = segments;
  if (!isValidVaultAlias(alias) || !secret) return null;

  return { alias, secret, path };
};

/** Whether a field value is a well-formed reference. */
export const isSecretRef = (value: unknown): boolean =>
  parseSecretRef(value) !== null;

/**
 * Render a reference, using dot form only where the segment is a bare
 * identifier. Real AWS secret names contain `/` and `!`, so the bracket form is
 * the common case rather than the exception — Retool's own "Reference" column
 * emits brackets for the same reason.
 */
export const buildSecretRef = ({
  alias,
  secret,
  path = [],
}: {
  alias: string;
  secret: string;
  path?: string[];
}): string => {
  const accessor = (segment: string) =>
    isJsIdentifier(segment) ? `.${segment}` : `[${JSON.stringify(segment)}]`;

  return `{{ ${SECRETS_NAMESPACE}${accessor(alias)}${accessor(secret)}${path
    .map(accessor)
    .join('')} }}`;
};

/**
 * A connected vault. Mirrors `nc_vaults`, minus `config` — the provider auth
 * parameters NEVER leave the backend, not even to a workspace owner. Clients
 * only ever see which provider is connected and whether it is reachable.
 *
 * `title` doubles as the reference alias, so it is unique per workspace and
 * immutable once set.
 */
export interface VaultType {
  id?: string;
  /** Set when the vault belongs to ONE workspace. Mutually exclusive with `fk_org_id`. */
  fk_workspace_id?: string;
  /** Set when the vault is shared by every workspace in the org. */
  fk_org_id?: string;
  /**
   * The alias used in references. Matches VAULT_ALIAS_PATTERN.
   *
   * Unique across BOTH scopes, not per scope: two vaults named `awsProd` — one
   * on the org, one on a workspace — would make `{{ secrets.awsProd.password }}`
   * resolve against a different AWS account depending on who read it, with
   * nothing in the reference to show it. n8n makes its provider key globally
   * unique for the same reason; Retool allows the collision and publishes a
   * caution about it.
   */
  title?: string;
  provider?: VaultProviderType;
  meta?: Record<string, any>;
  created_by?: string;
  created_at?: string;
  updated_at?: string;
}

/** Outcome of a `vaultTestConnection` probe, surfaced in the wizard's last step. */
export interface VaultTestResultType {
  ok: boolean;
  /** Safe, actionable summary — never a raw provider error. */
  message?: string;
}

/** One field in a provider's auth form. */
export interface VaultProviderField {
  key: string;
  label: string;
  placeholder?: string;
  required?: boolean;
  /** Masked on input and never echoed back once stored. */
  secret?: boolean;
  helpText?: string;
}

/**
 * Per-provider presentation + form definition, so the connect wizard is
 * data-driven rather than five hand-written branches.
 *
 * `available` gates the picker: every provider in the design is listed, but only
 * those with a working driver can be selected.
 */
export interface VaultProviderMeta {
  type: VaultProviderType;
  title: string;
  /** One-line description shown under the title in the picker. */
  description: string;
  /** Auth-method chip on the right of the picker row, e.g. `IAM role · OIDC`. */
  authLabel: string;
  /** Key in the frontend `iconMap`. */
  icon: string;
  available: boolean;
  /** Whether a reference may address a field inside a JSON secret. */
  supportsProperty: boolean;
  fields: VaultProviderField[];
}

export const VAULT_PROVIDER_META: Record<VaultProviderType, VaultProviderMeta> =
  {
    [VaultProviderType.HASHICORP_VAULT]: {
      type: VaultProviderType.HASHICORP_VAULT,
      title: 'HashiCorp Vault',
      description:
        'HCP Vault or self-hosted. KV v2, database and AWS secrets engines.',
      authLabel: 'AppRole · JWT',
      icon: 'ncLogoHashicorpVault',
      available: false,
      supportsProperty: true,
      fields: [],
    },
    [VaultProviderType.AWS_SECRETS_MANAGER]: {
      type: VaultProviderType.AWS_SECRETS_MANAGER,
      title: 'AWS Secrets Manager',
      description: 'Assume an IAM role in your account. No long-lived keys.',
      authLabel: 'IAM role · OIDC',
      icon: 'NcAmazonAws',
      available: true,
      supportsProperty: true,
      fields: [
        {
          key: 'region',
          label: 'Region',
          placeholder: 'us-east-1',
          required: true,
        },
        {
          key: 'roleArn',
          label: 'Role ARN',
          placeholder: 'arn:aws:iam::123456789012:role/NocoDBVaultAccess',
          required: true,
          helpText:
            'An IAM role in your account that trusts this workspace as an OIDC provider.',
        },
      ],
    },
    [VaultProviderType.AZURE_KEY_VAULT]: {
      type: VaultProviderType.AZURE_KEY_VAULT,
      title: 'Azure Key Vault',
      description: 'Entra ID app registration or managed identity.',
      authLabel: 'Entra ID · client cert',
      icon: 'ncLogoAzureColored',
      available: false,
      // A Key Vault secret is one opaque string — a reference names the whole
      // secret.
      supportsProperty: false,
      fields: [],
    },
    [VaultProviderType.GOOGLE_SECRET_MANAGER]: {
      type: VaultProviderType.GOOGLE_SECRET_MANAGER,
      title: 'Google Secret Manager',
      description:
        'Workload identity federation. No service-account keys to rotate.',
      authLabel: 'Workload identity',
      icon: 'ncLogoGoogleColored',
      available: false,
      supportsProperty: false,
      fields: [],
    },
    [VaultProviderType.CYBERARK_CONJUR]: {
      type: VaultProviderType.CYBERARK_CONJUR,
      title: 'CyberArk Conjur',
      description: 'Conjur Cloud or Enterprise. Host identity with API key or JWT.',
      authLabel: 'Host · JWT',
      icon: 'ncLogoCyberarkConjur',
      available: false,
      supportsProperty: false,
      fields: [],
    },
  };

/** Picker order — matches the design. */
export const VAULT_PROVIDER_ORDER: VaultProviderType[] = [
  VaultProviderType.HASHICORP_VAULT,
  VaultProviderType.AWS_SECRETS_MANAGER,
  VaultProviderType.AZURE_KEY_VAULT,
  VaultProviderType.GOOGLE_SECRET_MANAGER,
  VaultProviderType.CYBERARK_CONJUR,
];
