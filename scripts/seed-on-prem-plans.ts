/**
 * Seed On-Prem Plans & Add-ons via Stripe + NocoDB Backend
 *
 * Creates or updates Stripe products/prices for on-prem plans and add-ons and
 * registers them in the NocoDB database via the internal payment API. Fully
 * idempotent — safe to re-run at any time to update metadata, descriptions, or
 * pricing.
 *
 * Pricing uses tiered per-unit (volume) pricing — one tier applies based on
 * total seat count, matching the cloud plan pricing model.
 *
 * Prerequisites:
 *   - Backend running in EE mode with NC_STRIPE_SECRET_KEY set
 *   - NC_STRIPE_SECRET_KEY env var set (test or live key)
 *
 * Usage:
 *   NC_STRIPE_SECRET_KEY=sk_test_... npx tsx scripts/seed-on-prem-plans.ts
 *   NC_STRIPE_SECRET_KEY=sk_test_... npx tsx scripts/seed-on-prem-plans.ts --force
 *
 * Flags:
 *   --force   Dev mode: remove existing products/prices before re-creating.
 *             Tries to delete products first; if in use, clears lookup keys
 *             on prices and archives the product, then creates fresh ones.
 *
 * Environment variables:
 *   NC_STRIPE_SECRET_KEY  (required) — Stripe API key
 *   NC_BACKEND_URL        (optional) — Backend base URL (default: http://localhost:8080)
 *   NC_HTTP_BASIC_USER    (optional) — Basic auth user (default: defaultusername)
 *   NC_HTTP_BASIC_PASS    (optional) — Basic auth pass (default: defaultpassword)
 */

import Stripe from "stripe";

// ─── Config ──────────────────────────────────────────────────────────────────

const STRIPE_SECRET_KEY = process.env.NC_STRIPE_SECRET_KEY;
const BACKEND_URL = process.env.NC_BACKEND_URL || "http://localhost:8080";
const BASIC_USER = process.env.NC_HTTP_BASIC_USER || "defaultusername";
const BASIC_PASS = process.env.NC_HTTP_BASIC_PASS || "defaultpassword";
const FORCE_MODE = process.argv.includes("--force");

if (!STRIPE_SECRET_KEY) {
  console.error("Error: NC_STRIPE_SECRET_KEY is required.");
  console.error(
    "Usage: NC_STRIPE_SECRET_KEY=sk_test_... npx tsx scripts/seed-on-prem-plans.ts",
  );
  process.exit(1);
}

const stripe = new Stripe(STRIPE_SECRET_KEY);

const BASIC_AUTH = Buffer.from(`${BASIC_USER}:${BASIC_PASS}`).toString(
  "base64",
);

// ─── Plan definitions ────────────────────────────────────────────────────────
// Values match OnPremPlanTitles and OnPremPlanPriceLookupKeys from nocodb-sdk.
// Hardcoded here to keep the script standalone (no monorepo build dependency).
//
// Pricing uses volume tiers: one tier applies based on total seat count.
// All amounts are in cents. Adjust tiers before production deployment.

interface TierDef {
  up_to: number | "inf";
  unit_amount: number; // cents per seat
  flat_amount?: number;
}

// A price is either tiered volume (per-seat — `tiers`) or a flat per-unit fee
// (`unit_amount`, billed at quantity 1). Add-ons billed `flat` use the latter.
interface PriceDef {
  lookup_key: string;
  interval: "month" | "year";
  tiers?: TierDef[];
  unit_amount?: number; // cents — flat per-unit price (when `tiers` omitted)
}

interface PlanDef {
  name: string;
  description: string;
  metadata: Record<string, string>;
  prices: PriceDef[];
}

// An add-on is a separately-purchasable SKU (PlanAddonTypes) registered in the
// catalog alongside plans. Same Stripe product/price shape as a plan; the
// `addon_key` ties the Stripe product to the backend add-on definition.
interface AddonDef extends PlanDef {
  addon_key: string; // matches PlanAddonTypes in nocodb-sdk
}

// Note: only `description_*` keys in product metadata are stored on the plan
// (`fetchStripeProductDetails` in payment.service.ts strips everything else).
// Feature/limit gating is resolved at runtime from OnPremPlanDefinitions (SDK).
// `min_seats` is set on the subscription at checkout time (per-plan), not
// stored on the product. So we only carry description_* here.
const ON_PREM_PLANS: PlanDef[] = [
  {
    name: "Self-hosted Business", // OnPremPlanTitles.SELF_HOSTED_BUSINESS
    description: "Self-hosted NocoDB for growing teams (self-serve)",
    metadata: {
      description_1: "Unlimited records",
      description_2: "Unlimited commenters & viewers",
      description_3: "SSO, 2FA, Admin Panel",
      description_4: "Permissions, Sync, Teams, Scripts",
      description_5: "Snapshots, Webhooks, Workflows",
    },
    prices: [
      {
        lookup_key: "on_prem_business_monthly", // OnPremPlanPriceLookupKeys.BUSINESS_MONTHLY
        interval: "month",
        tiers: [{ up_to: "inf", unit_amount: 3000 }],
      },
      {
        lookup_key: "on_prem_business_yearly", // OnPremPlanPriceLookupKeys.BUSINESS_YEARLY
        interval: "year",
        tiers: [{ up_to: "inf", unit_amount: 28800 }], // $24/seat/month × 12 = $288/seat/year
      },
    ],
  },
  {
    name: "Self-hosted Scale", // OnPremPlanTitles.SELF_HOSTED_SCALE
    description: "Self-hosted NocoDB for scaling teams (self-serve)",
    metadata: {
      description_1: "Everything in Business",
      description_2: "Unlimited workspaces",
      description_3: "Audit logs, Team hierarchy, RLS",
      description_4: "Multi-provider AI",
    },
    prices: [
      {
        lookup_key: "on_prem_scale_monthly", // OnPremPlanPriceLookupKeys.SCALE_MONTHLY
        interval: "month",
        tiers: [{ up_to: "inf", unit_amount: 5400 }], // $54/seat/month
      },
      {
        lookup_key: "on_prem_scale_yearly", // OnPremPlanPriceLookupKeys.SCALE_YEARLY
        interval: "year",
        tiers: [{ up_to: "inf", unit_amount: 54000 }], // $45/seat/month × 12 = $540/seat/year
      },
    ],
  },
  // Enterprise is contact-sales only — no Stripe pricing.
  // Licenses are created manually by admin via internal API.
  // The plan definition still exists in OnPremPlanDefinitions (SDK)
  // so feature gating works once a license is issued.
];

// ─── Add-on definitions ──────────────────────────────────────────────────────
// Add-ons are separately-purchasable SKUs that unlock a capability on top of a
// plan (see AddonDefinitions in nocodb-sdk). Registered in the same catalog as
// plans via POST /api/internal/payment/addon. `addon_key` must match
// PlanAddonTypes. Lookup keys are free-form — only `private_*` and `loyalty`
// are reserved (the grant flow skips them when picking the default price).
//
// SCIM, white-label and MSSQL all bill `per_seat` (Stripe quantity = billable
// seats), so they use tiered volume pricing like the plans. Each carries month
// + year prices so the add-on can co-term with either a monthly or yearly
// subscription.
//
// Min-plan gating (all three → Self-hosted Scale; white-label is on-prem only)
// is enforced at grant time from AddonDefinitions, not here.
const ON_PREM_ADDONS: AddonDef[] = [
  {
    addon_key: "addon_scim", // PlanAddonTypes.ADDON_SCIM
    name: "SCIM Provisioning", // becomes Addon.title
    description: "Automated user provisioning & deprovisioning via SCIM 2.0",
    metadata: {
      description_1: "Automated user provisioning",
      description_2: "Directory sync (Okta, Entra ID, …)",
      description_3: "Group-based access management",
    },
    prices: [
      {
        lookup_key: "addon_scim_monthly",
        interval: "month",
        tiers: [{ up_to: "inf", unit_amount: 800 }], // $8/seat/month
      },
      {
        lookup_key: "addon_scim_yearly",
        interval: "year",
        tiers: [{ up_to: "inf", unit_amount: 8400 }], // $7/seat/month × 12
      },
    ],
  },
  {
    addon_key: "addon_white_label", // PlanAddonTypes.ADDON_WHITE_LABEL
    name: "White Labeling", // becomes Addon.title
    description: "Remove NocoDB branding and apply your own",
    metadata: {
      description_1: "Custom logo & branding",
      description_2: "Custom email sender",
      description_3: "Remove NocoDB branding",
    },
    prices: [
      {
        lookup_key: "addon_white_label_monthly",
        interval: "month",
        tiers: [{ up_to: "inf", unit_amount: 2500 }], // $25/seat/month
      },
      {
        lookup_key: "addon_white_label_yearly",
        interval: "year",
        tiers: [{ up_to: "inf", unit_amount: 25000 }], // $250/seat/year
      },
    ],
  },
  {
    addon_key: "addon_mssql", // PlanAddonTypes.ADDON_MSSQL
    name: "SQL Server Sources", // becomes Addon.title
    description: "Connect Microsoft SQL Server databases as external sources",
    metadata: {
      description_1: "Connect Microsoft SQL Server",
      description_2: "Sync & browse SQL Server data",
      description_3: "Read/write external SQL Server tables",
    },
    prices: [
      {
        lookup_key: "addon_mssql_monthly",
        interval: "month",
        tiers: [{ up_to: "inf", unit_amount: 1000 }], // $10/seat/month
      },
      {
        lookup_key: "addon_mssql_yearly",
        interval: "year",
        tiers: [{ up_to: "inf", unit_amount: 10000 }], // $100/seat/year
      },
    ],
  },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

const ok = (msg: string) => console.log(`  ✓ ${msg}`);
const skip = (msg: string) => console.log(`  → ${msg}`);
const fail = (msg: string) => console.error(`  ✗ ${msg}`);

/**
 * Find an existing active Stripe product by exact name.
 * Uses products.list() with pagination — unlike products.search(), this is
 * strongly consistent and will find products immediately after creation.
 */
async function findExistingProduct(
  name: string,
): Promise<Stripe.Product | null> {
  let hasMore = true;
  let startingAfter: string | undefined;

  while (hasMore) {
    const params: Stripe.ProductListParams = { limit: 100, active: true };
    if (startingAfter) params.starting_after = startingAfter;

    const page = await stripe.products.list(params);

    const match = page.data.find((p) => p.name === name);
    if (match) return match;

    hasMore = page.has_more;
    if (page.data.length > 0) {
      startingAfter = page.data[page.data.length - 1].id;
    }
  }

  return null;
}

async function backendRequest(
  method: string,
  path: string,
  body?: Record<string, unknown>,
): Promise<{ ok: boolean; status: number; data: any }> {
  const res = await fetch(`${BACKEND_URL}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Basic ${BASIC_AUTH}`,
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

  const text = await res.text();
  let data: any;
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }

  return { ok: res.ok, status: res.status, data };
}

/**
 * Force-remove a Stripe product and its prices.
 * 1. Try to delete the product outright (works if no active subscriptions).
 * 2. If deletion fails, clear lookup_key on all prices, deactivate them, then archive the product.
 */
async function forceRemoveProduct(product: Stripe.Product): Promise<void> {
  // Collect all prices for this product
  const prices: Stripe.Price[] = [];
  for await (const price of stripe.prices.list({
    product: product.id,
    limit: 100,
  })) {
    prices.push(price);
  }

  try {
    // Deactivate prices first — product deletion requires no active prices
    for (const price of prices) {
      if (price.active) {
        await stripe.prices.update(price.id, { active: false });
      }
    }

    await stripe.products.del(product.id);
    ok(`Deleted product ${product.id}`);
  } catch {
    // Product is in use (has subscriptions) — archive instead.
    // Lookup keys are transferred when new prices are created (transfer_lookup_key).
    await stripe.products.update(product.id, { active: false });
    ok(`Archived product ${product.id} (in use — cannot delete)`);
  }
}

function formatTierPrice(tier: TierDef, interval: string): string {
  const perSeat = tier.unit_amount / 100;
  const upTo = tier.up_to === "inf" ? "∞" : tier.up_to;
  return `up_to=${upTo} → $${perSeat}/seat/${interval}`;
}

/**
 * Idempotently upsert a Stripe product (matched by exact name) and its prices.
 * Shared by plan and add-on seeding — both use the same product/price shape.
 * Supports tiered volume prices (per-seat) and flat per-unit prices (add-ons
 * billed `flat`, charged at quantity 1).
 */
async function ensureStripeProduct(def: {
  name: string;
  description: string;
  metadata: Record<string, string>;
  prices: PriceDef[];
}): Promise<Stripe.Product> {
  // Find or create the Stripe product (by exact name match)
  let product = await findExistingProduct(def.name);

  if (product && FORCE_MODE) {
    await forceRemoveProduct(product);
    product = null;
  }

  if (product) {
    product = await stripe.products.update(product.id, {
      name: def.name,
      description: def.description,
      metadata: def.metadata,
    });
    ok(`Updated Stripe product: ${product.id}`);
  } else {
    product = await stripe.products.create({
      name: def.name,
      description: def.description,
      metadata: def.metadata,
    });
    ok(`Created Stripe product: ${product.id}`);
  }

  // Create prices (skip if lookup_key already exists, unless --force)
  for (const priceDef of def.prices) {
    if (!FORCE_MODE) {
      const existing = await stripe.prices.list({
        lookup_keys: [priceDef.lookup_key],
        limit: 1,
      });

      if (existing.data.length > 0) {
        skip(
          `Price ${priceDef.lookup_key} already exists: ${existing.data[0].id}`,
        );
        continue;
      }
    }

    const common: Stripe.PriceCreateParams = {
      product: product.id,
      currency: "usd",
      recurring: { interval: priceDef.interval, usage_type: "licensed" },
      lookup_key: priceDef.lookup_key,
      // In force mode, transfer the lookup key from any existing price
      ...(FORCE_MODE ? { transfer_lookup_key: true } : {}),
    };

    const price = priceDef.tiers
      ? await stripe.prices.create({
          ...common,
          billing_scheme: "tiered",
          tiers_mode: "volume",
          tiers: priceDef.tiers.map((t) => ({
            up_to: t.up_to === "inf" ? "inf" : t.up_to,
            unit_amount: t.unit_amount,
            flat_amount: t.flat_amount ?? 0,
          })),
        })
      : await stripe.prices.create({
          ...common,
          billing_scheme: "per_unit",
          unit_amount: priceDef.unit_amount!,
        });

    ok(`Created price ${priceDef.lookup_key}: ${price.id}`);
    if (priceDef.tiers) {
      for (const tier of priceDef.tiers) {
        console.log(`      ${formatTierPrice(tier, priceDef.interval)}`);
      }
    } else {
      console.log(
        `      flat → $${priceDef.unit_amount! / 100}/${priceDef.interval}`,
      );
    }
  }

  return product;
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log(
    `\n=== Seed On-Prem Plans & Add-ons${FORCE_MODE ? " (--force)" : ""} ===\n`,
  );

  // 1. Verify Stripe connection
  console.log("  Checking Stripe connection...");
  try {
    await stripe.products.list({ limit: 1 });
    ok("Stripe connected");
  } catch (e: any) {
    fail(`Stripe connection failed: ${e.message}`);
    process.exit(1);
  }

  // 2. Verify backend is reachable
  console.log("  Checking backend connection...");
  try {
    const res = await fetch(`${BACKEND_URL}/api/v1/health`);
    if (!res.ok) throw new Error(`Health check returned ${res.status}`);
    ok(`Backend reachable at ${BACKEND_URL}`);
  } catch (e: any) {
    fail(`Backend not reachable at ${BACKEND_URL}: ${e.message}`);
    fail("Make sure the backend is running with NC_STRIPE_SECRET_KEY set");
    process.exit(1);
  }

  console.log("");

  // 3. Process each plan
  for (const planDef of ON_PREM_PLANS) {
    console.log(`[${planDef.name}]`);

    // 3a/3b. Upsert Stripe product + prices
    const product = await ensureStripeProduct(planDef);

    // 3c. Register or sync plan in backend DB
    const createResult = await backendRequest(
      "POST",
      "/api/internal/payment/plan",
      {
        stripe_product_id: product.id,
      },
    );

    if (createResult.ok) {
      ok("Registered plan in database");
    } else if (
      createResult.data?.msg?.includes("already exists") ||
      createResult.status === 409
    ) {
      // Plan exists — sync to pick up metadata/price changes
      const syncResult = await backendRequest(
        "PATCH",
        "/api/internal/payment/plan",
      );
      if (syncResult.ok) {
        ok("Synced all plans from Stripe");
      } else {
        fail(`Failed to sync plans: ${JSON.stringify(syncResult.data)}`);
      }
    } else {
      fail(`Failed to register plan: ${JSON.stringify(createResult.data)}`);
    }

    console.log("");
  }

  // 4. Process each add-on (registered in the same catalog as plans)
  for (const addonDef of ON_PREM_ADDONS) {
    console.log(`[${addonDef.name}]`);

    // 4a/4b. Upsert Stripe product + prices
    const product = await ensureStripeProduct(addonDef);

    // 4c. Register or sync add-on in backend DB
    const createResult = await backendRequest(
      "POST",
      "/api/internal/payment/addon",
      {
        stripe_product_id: product.id,
        addon_key: addonDef.addon_key,
      },
    );

    if (createResult.ok) {
      ok("Registered add-on in database");
    } else if (
      createResult.data?.msg?.includes("already registered") ||
      createResult.status === 409
    ) {
      // Add-on exists — sync all to pick up metadata/price changes
      const syncResult = await backendRequest(
        "PATCH",
        "/api/internal/payment/addon",
      );
      if (syncResult.ok) {
        ok("Synced all add-ons from Stripe");
      } else {
        fail(`Failed to sync add-ons: ${JSON.stringify(syncResult.data)}`);
      }
    } else {
      fail(`Failed to register add-on: ${JSON.stringify(createResult.data)}`);
    }

    console.log("");
  }

  console.log("=== Done ===\n");
}

main().catch((e) => {
  console.error("\nFatal error:", e.message);
  process.exit(1);
});
