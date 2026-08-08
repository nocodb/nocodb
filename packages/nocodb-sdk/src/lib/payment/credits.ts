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

/**
 * Metered upstreams: `ai` priced per token, `compute` per second, `web` per
 * search and retrieved document.
 */
export enum CreditServiceType {
  AI = 'ai',
  COMPUTE = 'compute',
  WEB = 'web',
}

/**
 * One active grant block in the balance breakdown, in display credits. The
 * billing page renders these as the per-pack rows ("10,000 pack — 2,604 left,
 * expires 15 Aug 2026") and derives the plan/top-up segmentation from `type`.
 */
export interface CreditGrantSummaryType {
  id: string;
  /** Loose on purpose — a newer cloud may serve kinds this build predates. */
  type: CreditGrantType | string;
  /** Originally granted amount. */
  credits: number;
  /** What is left of this grant right now. */
  remaining: number;
  granted_at: string;
  /** Null for grants without a fixed window (e.g. manual adjustments). */
  expires_at?: string | null;
}

/** Balance for the UI, in display credits. */
export interface CreditBalanceType {
  available_credits: number;
  plan_credits: number;
  period_end?: string;
  low: boolean;
  /**
   * Active grant blocks the balance is made of, burn-order first. Optional —
   * older gateway peers answer the balance without it and the UI degrades to
   * the unsegmented bar.
   */
  grants?: CreditGrantSummaryType[];
}

/** One day of consumed credits for the usage chart. Display credits, ≥ 0. */
export interface CreditUsageDailyType {
  /** UTC calendar day, `YYYY-MM-DD`. */
  date: string;
  used: number;
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
 * Retrieval usage for a `web` debit. Keys mirror `CreditRateTable.web`.
 *
 * Deliberately provider-shaped rather than vendor-shaped: search and scrape are
 * the two legs every retrieval vendor sells (Exa, Tavily, Firecrawl, Brave …),
 * so adding one is a rate-table entry, not a new service.
 */
export interface CreditWebUsage {
  /**
   * Web provider that served it, e.g. 'exa'. This is the pricing key —
   * providers differ enough in cost that one flat per-call rate cannot cover
   * them. Where a vendor sells tiers at different prices, report the qualified
   * `provider:tier` (Exa's costlier Deep Search would be `exa:deep`) and give
   * the bare name that vendor's priciest rate, so an unqualified report can
   * never land on a cheaper tier than the call actually used.
   */
  provider?: string;
  /** Which leg ran, e.g. 'search' | 'scrape'. Audit only. */
  operation?: string;
  /**
   * Search requests issued. A scrape reports 0 — it fetches a known URL without
   * searching, and that leg is priced per page rather than per request. The
   * count therefore also selects which leg of the rate applies.
   */
  searches?: number;
  /**
   * Documents retrieved: search results, or fetched pages. Vendors bill each
   * content type (text / highlights / summary) of a page as its own document,
   * so a fetch asking for two of them reports 2, not 1.
   *
   * Report 0 explicitly for a search that matched nothing. An ABSENT count
   * means "not reported" and falls back to the provider's assumed result count,
   * so an under-reporting call is charged as a normal one rather than as free.
   */
  documents?: number;
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
  /**
   * One segment per web call the turn made — always a list, even for one.
   *
   * An agent turn routinely runs several searches and then scrapes the best
   * hits; each is priced on its own quantities, so segments never collapse.
   */
  web?: CreditWebUsage[];
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


/**
 * Why a ledger row exists, in user-explainable terms — the unified vocabulary
 * every writer stamps and the ONE thing the billing UI renders explanations
 * from. A discriminated union so a writer cannot invent a shape the renderer
 * doesn't know: adding a reason means adding a variant here plus its i18n
 * template, and the compiler holds both sides to it.
 *
 * All amounts are DISPLAY credits (not micro) — this is presentation data.
 */
export type CreditLedgerReasonType =
  /** The period's plan allowance (first grant, lazy free-tier, renewal). */
  | {
      kind: 'period_grant';
      rate: number;
      per_seat?: number;
      seats?: number;
    }
  /** Mid-period re-price after a plan switch. */
  | {
      kind: 'plan_reprice';
      rate: number;
      per_seat?: number;
      seats?: number;
      /** Credits already earned at the previous rate(s) this period. */
      accrued: number;
      /** Consumption carried into the replacement grant. */
      carried_consumed: number;
    }
  /** Mid-period re-price after a chargeable-seat change. */
  | {
      kind: 'seat_reprice';
      rate: number;
      per_seat?: number;
      seats?: number;
      accrued: number;
      carried_consumed: number;
    }
  /** Closed because a re-priced allowance replaced it (pairs with a reprice). */
  | { kind: 'superseded' }
  /** Plan allowance lapsed with the billing period. */
  | { kind: 'period_end' }
  /** A top-up hit the end of its rollover window. */
  | { kind: 'rollover_end'; months: number }
  /**
   * A plan grant lapsed while carrying overspend debt. The debt is NOT
   * forgiven — it converts to unattributed scope debt (this row) that the next
   * grant retires. Forgiving it was the seat-cycling exploit's reset button:
   * pump seats, burn the prorated allowance, drop the seats, wait out the
   * period, repeat.
   */
  | { kind: 'debt_carried' }
  /** A new grant retired earlier overspend debt (pairs net to zero). */
  | { kind: 'debt_settled' }
  /**
   * A downgrade re-priced the period below what was already spent; the excess
   * is charged in the NORMAL burn order (remaining plan credits, then
   * top-ups) — the ledger ends up as if the final entitlement had applied all
   * along. Any unfunded remainder becomes unattributed debt (`debt_carried` /
   * `debt_settled` take over from there).
   */
  | { kind: 'overspend_charge' }
  /** Paid top-up pack. */
  | { kind: 'topup'; pack_credits: number }
  /** Stripe refund/chargeback clawed the fulfilled top-up back. */
  | { kind: 'refund' }
  /**
   * Balance moved between scopes (e.g. workspace → org). `title` is a
   * SNAPSHOT of the counterpart's display name at move time — the ledger is a
   * historical record and must still read correctly after the counterpart is
   * renamed or deleted; the id stays for audit.
   */
  | {
      kind: 'transfer_out';
      to_scope: CreditScope;
      to_scope_id: string;
      to_title?: string;
    }
  | {
      kind: 'transfer_in';
      from_scope: CreditScope;
      from_scope_id: string;
      from_title?: string;
    };

/** Ledger-row `meta` payload. */
export interface CreditLedgerMetaType {
  reason?: CreditLedgerReasonType;
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
  /** Why the row exists — see {@link CreditLedgerReasonType}. */
  meta?: CreditLedgerMetaType | null;
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
  /** Highlighted with a "Popular" badge in the pack picker. */
  popular?: boolean;
}
