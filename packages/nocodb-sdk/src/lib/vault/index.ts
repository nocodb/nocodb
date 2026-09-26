/**
 * Enterprise Vaults. A credential field holds a reference, fetched from the
 * provider at connection time:
 *
 *     { "$vault": { "alias": "awsProd", "secret": "prod/db/creds", "path": ["password"] } }
 *
 * `formatSecretRef` renders it as `secrets.awsProd["prod/db/creds"].password`.
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

/** A vault's alias: a bare identifier, so `secrets.alias` always parses in dot form. */
export const VAULT_ALIAS_PATTERN = /^[a-zA-Z][a-zA-Z0-9]*$/;

/** Aliases a vault may not take. */
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
  /** Key path into a JSON secret. Empty means the whole secret, a string. */
  path: string[];
}

/** Whether a plain value contains the `{{ secrets… }}` brace syntax, parsed or not. */
export const mentionsSecretsNamespace = (value: unknown): boolean => {
  if (typeof value !== 'string') return false;

  // Also catches `{{ secret.v.k }}` and an unclosed `{{ secrets.v.k`.
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

/** The reference in a stored field value, or null. */
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

/** Readable form, for display and input. */
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

/** A partly typed reference, for segment-by-segment completion. */
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

/** Tokenize the readable form, tolerating an unfinished tail. */
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

      // Settled only once something follows it.
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

      // `formatSecretRef` escapes with JSON.stringify.
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

/** Parse the readable form. The only place text becomes a reference. */
export const parseSecretRefText = (text: string): ParsedSecretRef | null => {
  const draft = parseSecretRefDraft(text);

  // A `["` left open is still being typed.
  if (!draft.rooted || !draft.valid || draft.bracketed) return null;

  const segments = [...draft.segments];
  if (draft.fragment) segments.push(draft.fragment);

  const [alias, secret, ...path] = segments;

  if (!alias || !isValidVaultAlias(alias)) return null;
  if (!secret) return null;
  if (path.some((segment) => !segment)) return null;

  return { alias, secret, path };
};

/** Splice a completion over the segment being typed. */
export const applySecretRefCompletion = (
  text: string,
  draft: SecretRefDraft,
  value: string
): string => {
  const head = (text ?? '').slice(0, draft.fragmentStart);

  // Already inside `["`, so only the value and the closers are missing.
  if (draft.bracketed) return `${head}${value}"]`;

  if (isJsIdentifier(value)) return `${head}${value}`;

  // A name with `/` or `-` needs brackets, but the caret sits after a `.`.
  return `${head.replace(/\.$/, '')}[${JSON.stringify(value)}]`;
};

/**
 * Outcome of the last probe of a stored vault; absent means never probed. No
 * message: `meta` is public.
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

/** A connected vault, without `config`: auth parameters never leave the backend. */
export interface VaultType {
  id?: string;
  /** Set for a workspace vault. Exclusive with `fk_org_id`. */
  fk_workspace_id?: string;
  /** Set for an org vault. */
  fk_org_id?: string;
  /** The reference alias. Unique across org and workspace scope. */
  title?: string;
  provider?: VaultProviderType;
  meta?: VaultMetaType;
  /** Owning workspace's name, on the org listing only. */
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

/** Per-provider picker and form definition. `available` = has a working driver. */
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

/** Picker order. */
export const VAULT_PROVIDER_ORDER: VaultProviderType[] = [
  VaultProviderType.HASHICORP_VAULT,
  VaultProviderType.AWS_SECRETS_MANAGER,
  VaultProviderType.AZURE_KEY_VAULT,
  VaultProviderType.GOOGLE_SECRET_MANAGER,
  VaultProviderType.CYBERARK_CONJUR,
];
