/**
 * Enterprise Vaults — integration credentials sourced from a workspace's OWN
 * secrets manager.
 *
 * A credential field holds a REFERENCE, never the secret:
 *
 *     { "$vault": { "alias": "awsProd",
 *                   "secret": "prod/db/creds",
 *                   "path": ["password"] } }
 *
 * An object rather than a string so intent is structural: `$vault` present
 * means a reference was intended, and a malformed one is a validation error
 * rather than a password stored in the clear. `formatSecretRef` renders the
 * readable `secrets.awsProd["prod/db/creds"].password` form for display only.
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
 * A reference is an object, so a typo can no longer BECOME one by accident.
 * What this still catches is a human pasting the brace syntax into a plain
 * field — from older docs, another instance, or a colleague — which would
 * otherwise be stored verbatim as the credential. Databricks documents exactly
 * that failure: "Otherwise, the environment variable is considered a plain text
 * environment variable." Save paths reject it and point at the vault toggle.
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

/** The stored shape of a vault-backed field. */
export interface VaultSecretRef {
  $vault: {
    alias: string;
    secret: string;
    /** Key path into a JSON secret. Empty means the whole secret, a string. */
    path?: string[];
  };
}

/**
 * Parse a stored field value into a reference, or null when it is not one.
 *
 * A reference is an OBJECT, not a string. The string form this replaced could
 * not distinguish "meant as a reference but mistyped" from "a password that
 * happens to contain braces" — so a typo was stored as the credential, and a
 * heuristic (`mentionsSecretsNamespace`) had to guess. An object carries intent
 * structurally: `$vault` present means a reference was intended, and a
 * malformed one is a validation error rather than a password.
 *
 * n8n avoids the same problem differently, by marking expressions with a
 * leading `=` on the string. That works there because `$secrets` rides on a
 * general expression evaluator; an integration config has no expression layer,
 * and a sentinel prefix would misread a literal password beginning with `=`.
 */
export const parseSecretRef = (value: unknown): ParsedSecretRef | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;

  const ref = (value as VaultSecretRef).$vault;
  if (!ref || typeof ref !== 'object' || Array.isArray(ref)) return null;

  const { alias, secret, path } = ref as Record<string, unknown>;

  if (typeof alias !== 'string' || !isValidVaultAlias(alias)) return null;
  if (typeof secret !== 'string' || !secret) return null;

  if (path !== undefined) {
    if (!Array.isArray(path)) return null;
    if (path.some((segment) => typeof segment !== 'string' || !segment))
      return null;
  }

  return { alias, secret, path: (path as string[]) ?? [] };
};

/** Whether a stored field value is a well-formed reference. */
export const isSecretRef = (value: unknown): boolean =>
  parseSecretRef(value) !== null;

/** Build the stored form. The only place a reference is constructed. */
export const buildSecretRef = ({
  alias,
  secret,
  path = [],
}: {
  alias: string;
  secret: string;
  path?: string[];
}): VaultSecretRef => ({ $vault: { alias, secret, path } });

/** `.ident` or `['quoted']`, for rendering a reference to a human. */
const accessor = (segment: string): string =>
  isJsIdentifier(segment) ? `.${segment}` : `[${JSON.stringify(segment)}]`;

/**
 * Human-readable rendering, for the picker's preview and for error messages.
 * Display only — never stored, never parsed back.
 */
export const formatSecretRef = ({
  alias,
  secret,
  path = [],
}: {
  alias: string;
  secret: string;
  path?: string[];
}): string =>
  `${SECRETS_NAMESPACE}${accessor(alias)}${accessor(secret)}${path
    .map(accessor)
    .join('')}`;

/**
 * What a partially-typed reference says so far.
 *
 * The picker completes one segment at a time, so it needs to know which segment
 * the caret is in and what has been settled before it — not just whether the
 * whole string parses.
 */
export interface SecretRefDraft {
  /** Settled segments: alias, then secret, then key path. */
  segments: string[];
  /** The segment currently being typed. Empty right after a separator. */
  fragment: string;
  /** Caret is inside `[" "]`, so a completion must not re-add the bracket. */
  bracketed: boolean;
  /** Index in the source text where `fragment` begins. */
  fragmentStart: number;
  /** The text starts with the `secrets` namespace. */
  rooted: boolean;
  /** No trailing junk the tokenizer could not read. */
  valid: boolean;
}

const QUOTES = ['"', "'"];

/**
 * Tokenize `secrets.alias["secret"].key` — the form `formatSecretRef` emits.
 *
 * Deliberately tolerant of an unfinished tail, because it runs on every
 * keystroke. `valid` is false only when the text contains something the grammar
 * cannot read at all, which is what the strict parser below keys on.
 */
export const parseSecretRefDraft = (text: string): SecretRefDraft => {
  const draft: SecretRefDraft = {
    segments: [],
    fragment: '',
    bracketed: false,
    fragmentStart: 0,
    rooted: false,
    valid: true,
  };

  const raw = text ?? '';
  let i = 0;

  const ws = () => {
    while (i < raw.length && /\s/.test(raw[i])) i++;
  };

  ws();

  // The namespace may itself be half-typed (`secr`), which is rooted enough to
  // offer aliases once it completes but not before.
  if (!raw.startsWith(SECRETS_NAMESPACE, i)) {
    draft.valid = false;
    draft.fragmentStart = i;
    draft.fragment = raw.slice(i);
    return draft;
  }

  i += SECRETS_NAMESPACE.length;
  draft.rooted = true;
  draft.fragmentStart = i;

  while (i < raw.length) {
    ws();
    if (i >= raw.length) break;

    if (raw[i] === '.') {
      i++;
      draft.fragmentStart = i;
      draft.bracketed = false;

      let ident = '';
      while (i < raw.length && /[A-Za-z0-9_$]/.test(raw[i])) ident += raw[i++];

      // A settled segment only when something else follows it; otherwise the
      // user is still typing this one.
      if (i < raw.length) {
        draft.segments.push(ident);
      } else {
        draft.fragment = ident;
      }
      continue;
    }

    if (raw[i] === '[') {
      i++;
      ws();

      const quote = QUOTES.includes(raw[i]) ? raw[i] : '';
      if (!quote) {
        draft.valid = false;
        return draft;
      }

      i++;
      draft.fragmentStart = i;
      draft.bracketed = true;

      // Escape-aware, because `formatSecretRef` renders with JSON.stringify:
      // a secret named `a"b` comes out as `["a\\"b"]`.
      let value = '';
      while (i < raw.length && raw[i] !== quote) {
        if (raw[i] === '\\' && i + 1 < raw.length) {
          value += raw[i + 1];
          i += 2;
          continue;
        }
        value += raw[i++];
      }

      if (i >= raw.length) {
        // Unterminated: still being typed.
        draft.fragment = value;
        return draft;
      }

      i++; // closing quote
      ws();

      if (raw[i] !== ']') {
        draft.valid = false;
        return draft;
      }

      i++;
      draft.segments.push(value);
      draft.fragment = '';
      draft.bracketed = false;
      draft.fragmentStart = i;
      continue;
    }

    draft.valid = false;
    return draft;
  }

  return draft;
};

/**
 * Parse the readable form back into a reference.
 *
 * The inverse of `formatSecretRef`, and the ONLY place a string becomes a
 * reference. It lives at the picker boundary — where the user has already said
 * "this field is vault-backed" — so intent is explicit. Nothing downstream
 * infers a reference from text, which is what keeps a mistyped password from
 * being stored as a credential.
 */
export const parseSecretRefText = (text: string): ParsedSecretRef | null => {
  const draft = parseSecretRefDraft(text);

  // `bracketed` survives to the end only when a `["` was never closed — that is
  // a segment still being typed, not a secret named by its prefix.
  if (!draft.rooted || !draft.valid || draft.bracketed) return null;

  const segments = [...draft.segments];
  if (draft.fragment) segments.push(draft.fragment);

  const [alias, secret, ...path] = segments;

  if (!alias || !isValidVaultAlias(alias)) return null;
  if (!secret) return null;
  if (path.some((segment) => !segment)) return null;

  return { alias, secret, path };
};

/**
 * Splice a chosen completion over the segment being typed, in the accessor
 * form `formatSecretRef` would have produced for it.
 */
export const applySecretRefCompletion = (
  text: string,
  draft: SecretRefDraft,
  value: string,
): string => {
  const head = (text ?? '').slice(0, draft.fragmentStart);

  // Already inside `["`, so only the value and the closers are missing.
  if (draft.bracketed) return `${head}${value}"]`;

  if (isJsIdentifier(value)) return `${head}${value}`;

  // A name with `/` or `-` needs brackets, but the caret sits after a `.`.
  return `${head.replace(/\.$/, '')}[${JSON.stringify(value)}]`;
};

/**
 * The recorded outcome of the last `vaultTestConnection` run against a STORED
 * vault. Absent means the vault has never been probed — which is a third state,
 * not a failure: nothing may render a vault as reachable on the strength of the
 * row existing.
 *
 * Carries no message. `meta` is returned by every list/read response, so a
 * provider error recorded here would be readable by anyone who may list vaults;
 * the message only ever travels in the `VaultTestResultType` handed back to the
 * caller who ran the probe.
 */
export interface VaultLastTestType {
  ok: boolean;
  /** ISO-8601 instant the probe finished. */
  at: string;
}

/** Response-safe vault metadata. */
export interface VaultMetaType {
  lastTest?: VaultLastTestType;
  [key: string]: any;
}

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
  meta?: VaultMetaType;
  /**
   * Display-only name of the owning workspace, joined in by the org-management
   * listing so its Scope column can name the workspace rather than print an id.
   * Never persisted, and absent everywhere else — including on org-owned rows.
   */
  workspace_title?: string;
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
  /** Auth-method chip on the right of the picker row, e.g. `Access keys`. */
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
      description: 'Read secrets with an IAM user scoped to Secrets Manager.',
      authLabel: 'Access keys',
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
          key: 'accessKeyId',
          label: 'Access key ID',
          placeholder: 'AKIAIOSFODNN7EXAMPLE',
          required: true,
        },
        {
          key: 'secretAccessKey',
          label: 'Secret access key',
          required: true,
          secret: true,
          helpText:
            'An IAM user scoped to reading secrets. Stored encrypted and never returned — rotate it in AWS.',
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
      description:
        'Conjur Cloud or Enterprise. Host identity with API key or JWT.',
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
