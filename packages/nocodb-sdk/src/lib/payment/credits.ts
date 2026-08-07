// ---------------------------------------------------------------------------
// Credit system — prepaid AI/compute credits (cloud + on-prem)
// ---------------------------------------------------------------------------
// One prepaid balance meters managed AI providers and sandboxed compute. At
// zero the gate throws ERR_CREDITS_EXHAUSTED (402). Rate table and per-plan
// LIMIT_CREDITS live in the EE payment module.
//
// 1 display credit ≙ $0.001, stored as integer micro-credits.
//
// The display unit is presentational only — all arithmetic happens in µcr. It
// is chosen so plan allowances read as familiar whole numbers; changing it
// rescales every displayed figure, so plan limits, packs and holds (all
// expressed in display credits) must move with it. Rates are already µcr and
// must NOT.
// ---------------------------------------------------------------------------

export const CREDIT_MICRO = 100_000;

/**
 * Which entity owns a balance: the org when a workspace belongs to one, else the
 * workspace. Not the subscription — that only exists after a Stripe purchase,
 * leaving the free tier nothing to attach credits to. An org pools one balance
 * across its workspaces.
 */
export enum CreditScope {
  WORKSPACE = 'workspace',
  ORG = 'org',
  INSTALLATION = 'installation',
}

/**
 * The (scope, id) pair every grant, ledger row and hold is keyed by. Passed
 * together — workspace and org ids share a nanoid alphabet, so `scopeId` alone
 * is ambiguous.
 */
export interface CreditScopeRef {
  scope: CreditScope;
  scopeId: string;
}

/** Grant blocks the balance is made of. */
export enum CreditGrantType {
  PLAN = 'plan',
  TOPUP = 'topup',
  PROMO = 'promo',
  ADJUSTMENT = 'adjustment',
}

/**
 * Burn order — lower burns first. Mirrors the `PlanOrder` idiom: the numbers
 * are the `priority` column, so the gaps leave room for new kinds without
 * renumbering. Plan credits burn before anything the customer paid cash for,
 * so a lapsing plan allowance is spent rather than wasted.
 */
export const CreditGrantOrder: Record<CreditGrantType, number> = {
  [CreditGrantType.PLAN]: 10,
  [CreditGrantType.PROMO]: 15,
  [CreditGrantType.TOPUP]: 20,
  [CreditGrantType.ADJUSTMENT]: 20,
};

/**
 * How long each kind of grant lives, in months from issuance. `null` means the
 * window is not a fixed duration and the issuer supplies it — plan credits
 * expire at the end of the billing period they were granted for, which is what
 * makes them non-rolling.
 */
export const CreditGrantExpiryMonths: Record<CreditGrantType, number | null> = {
  [CreditGrantType.PLAN]: null,
  [CreditGrantType.PROMO]: 12,
  [CreditGrantType.TOPUP]: 12,
  [CreditGrantType.ADJUSTMENT]: null,
};

/**
 * What produced a grant. Paired with a `source_id` under a unique constraint,
 * this is the idempotency key for issuance — the same (type, id) can only ever
 * create one grant, however many times a webhook is redelivered.
 */
export enum CreditGrantSourceType {
  /** Plan allowance for one billing period. id: `{scopeId}:{periodStart}`. */
  PLAN = 'plan',
  /** Paid top-up. id: the Stripe Checkout Session (`cs_…`). */
  STRIPE_CHECKOUT = 'stripe_checkout',
}

/** Append-only ledger entry kinds. Debits negative, grants positive. */
export enum CreditLedgerEntryType {
  GRANT = 'grant',
  CONSUME = 'consume',
  EXPIRE = 'expire',
  CLAWBACK = 'clawback',
  ADJUST = 'adjust',
}

/** Metered upstreams: `ai` priced per token, `compute` per second. */
export enum CreditServiceType {
  AI = 'ai',
  COMPUTE = 'compute',
}

/** Balance for the UI, in display credits. */
export interface CreditBalanceType {
  available_credits: number;
  plan_credits: number;
  period_end?: string;
  low: boolean;
}

/** Token usage for an `ai` debit. */
export interface CreditAiUsage {
  /**
   * Resolved `<provider>/<modelId>` that served the call.
   */
  model?: string;
  /**
   * `AiUseCase` the call served.
   */
  use_case?: string;
  input_tokens?: number;
  output_tokens?: number;
  cache_read_tokens?: number;
  cache_write_tokens?: number;
  reasoning_tokens?: number;
}

/** Resource usage for a `compute` debit. Keys mirror `CreditRateTable.compute`. */
export interface CreditComputeUsage {
  /**
   * Compute provider that ran it, e.g. 'e2b'. This is the pricing key —
   * providers differ enough in cost that one flat second-rate cannot cover them.
   */
  provider?: string;
  /** Instance id, qualified as `<provider>:<nativeId>`. Audit only. */
  sandbox_id?: string;
  seconds?: number;
  /**
   * Instance shape, billed per second alongside the clock. Omitted fields fall
   * back to the provider's default shape, so an under-reported instance is
   * charged as a normal one rather than as free.
   */
  vcpus?: number;
  memory_gib?: number;
  storage_gib?: number;
}

/**
 * The per-service payloads a usage envelope can carry — one key per
 * `CreditServiceType` value (the key IS the enum's string value, which is what
 * keeps the wire format stable)
 */
export interface CreditServiceUsageMap {
  /**
   * One segment per use case the call served — always a list, even for one.
   *
   * A chat turn routes across a router, a specialist and a summarizer, each
   * priced at its own rate. Summing tokens first and pricing the total at one
   * rate is meaningless when the table spans 30x, so segments never collapse.
   */
  ai?: CreditAiUsage[];
  compute?: CreditComputeUsage;
}

/**
 * Raw usage stamped on every debit row, for audit and re-rating. The group
 * matching the row's `service` carries the billable quantities; the rest is
 * common metadata.
 */
export interface CreditUsageRef extends CreditServiceUsageMap {
  request_id?: string;
  /** Usage was inferred (e.g. stream ended before reporting), not reported. */
  estimated?: boolean;
}


/** A ledger row as returned by `creditLedgerList`. */
export interface CreditLedgerRowType {
  id: string;
  scope: CreditScope;
  fk_scope_id: string;
  fk_grant_id: string | null;
  fk_workspace_id: string | null;
  fk_base_id: string | null;
  fk_user_id: string | null;
  fk_subscription_id: string | null;
  entry_type: CreditLedgerEntryType;
  amount_micro: number;
  /** Null on non-metered rows: grant, expire, clawback, adjust. */
  service: CreditServiceType | null;
  usage: CreditUsageRef | null;
  rate_version: string | null;
  idempotency_key: string | null;
  /** Shared by every row one settle wrote. Null on rows written before it. */
  correlation_id: string | null;
  created_at: string;
  updated_at: string;
}

/** Purchasable top-up bundle. */
export interface CreditPackType {
  id: string;
  credits: number;
  usd: number;
}
