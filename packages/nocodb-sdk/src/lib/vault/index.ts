/**
 * Enterprise Vaults — integration credentials sourced from a workspace's OWN
 * secrets manager.
 *
 * NocoDB stores a REFERENCE, never the secret. A credential field in an
 * integration config carries a `$secretRef` leaf naming (store, key, property);
 * the value is fetched from the provider at connection time and lives only in
 * the transient connection config.
 *
 * The reference shape follows the External Secrets Operator's `remoteRef`
 * ({key, property, version}) rather than inventing one. ESO is the only
 * widely-adopted convention built for this exact problem — one secret in an
 * external store that may itself be a JSON document — and it already backs 20+
 * providers, so it reads as familiar to the platform engineers who administer
 * this. AWS ships the same concept twice as a string (ECS `valueFrom` ARN
 * suffixes, CloudFormation `{{resolve:secretsmanager:…}}`) with the same
 * segment order, which is a useful corroboration of the field set.
 */

/** Secrets providers a workspace can connect. */
export enum VaultProviderType {
  HASHICORP_VAULT = 'hashicorp_vault',
  AWS_SECRETS_MANAGER = 'aws_secrets_manager',
  AZURE_KEY_VAULT = 'azure_key_vault',
  GOOGLE_SECRET_MANAGER = 'google_secret_manager',
  CYBERARK_CONJUR = 'cyberark_conjur',
}

/**
 * A pointer to one value inside a connected vault. Embedded as a leaf in an
 * integration config in place of the credential itself.
 *
 * `property` is OPTIONAL by design: AWS Secrets Manager and HashiCorp KV hold
 * JSON documents you address into, while Azure Key Vault, Google Secret Manager
 * and Conjur hold one opaque string per secret — for those, the reference names
 * the whole secret and `property` is omitted.
 */
export interface VaultSecretRef {
  $secretRef: {
    /** `nc_vaults.id` of the connected provider. */
    store: string;
    /** Provider-native secret identifier (ARN or name, KV path, secret name). */
    key: string;
    /** Field within a JSON secret. Omitted when the secret is a plain string. */
    property?: string;
    /** Provider-native version/stage (e.g. `AWSCURRENT`). Defaults to latest. */
    version?: string;
  };
}

/**
 * Whether a config value is a vault reference rather than a literal. The single
 * definition — backend resolver, response masking and the frontend form all use
 * this, so the shape can never drift between them.
 */
export const isVaultSecretRef = (value: unknown): value is VaultSecretRef => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const ref = (value as VaultSecretRef).$secretRef;
  return (
    !!ref &&
    typeof ref === 'object' &&
    typeof ref.store === 'string' &&
    !!ref.store &&
    typeof ref.key === 'string' &&
    !!ref.key
  );
};

/**
 * A connected vault. Mirrors `nc_vaults`, minus `config` — the provider auth
 * parameters NEVER leave the backend, not even to a workspace owner. Clients
 * only ever see which provider is connected and whether it is reachable.
 */
export interface VaultType {
  id?: string;
  fk_workspace_id?: string;
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
      description: 'HCP Vault or self-hosted. KV v2, database and AWS secrets engines.',
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
      description: 'Workload identity federation. No service-account keys to rotate.',
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
