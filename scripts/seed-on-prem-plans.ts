/**
 * Seed On-Prem Plans via Stripe + NocoDB Backend
 *
 * Creates or updates Stripe products/prices for on-prem plans and registers
 * them in the NocoDB database via the internal payment API. Fully idempotent —
 * safe to re-run at any time to update metadata, descriptions, or pricing.
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
 *
 * Environment variables:
 *   NC_STRIPE_SECRET_KEY  (required) — Stripe API key
 *   NC_BACKEND_URL        (optional) — Backend base URL (default: http://localhost:8080)
 *   NC_HTTP_BASIC_USER    (optional) — Basic auth user (default: defaultusername)
 *   NC_HTTP_BASIC_PASS    (optional) — Basic auth pass (default: defaultpassword)
 */

import Stripe from 'stripe';

// ─── Config ──────────────────────────────────────────────────────────────────

const STRIPE_SECRET_KEY = process.env.NC_STRIPE_SECRET_KEY;
const BACKEND_URL = process.env.NC_BACKEND_URL || 'http://localhost:8080';
const BASIC_USER = process.env.NC_HTTP_BASIC_USER || 'defaultusername';
const BASIC_PASS = process.env.NC_HTTP_BASIC_PASS || 'defaultpassword';

if (!STRIPE_SECRET_KEY) {
  console.error('Error: NC_STRIPE_SECRET_KEY is required.');
  console.error('Usage: NC_STRIPE_SECRET_KEY=sk_test_... npx tsx scripts/seed-on-prem-plans.ts');
  process.exit(1);
}

const stripe = new Stripe(STRIPE_SECRET_KEY);

const BASIC_AUTH = Buffer.from(`${BASIC_USER}:${BASIC_PASS}`).toString('base64');

// ─── Plan definitions ────────────────────────────────────────────────────────
// Values match OnPremPlanTitles and OnPremPlanPriceLookupKeys from nocodb-sdk.
// Hardcoded here to keep the script standalone (no monorepo build dependency).
//
// Pricing uses volume tiers: one tier applies based on total seat count.
// All amounts are in cents. Adjust tiers before production deployment.

interface TierDef {
  up_to: number | 'inf';
  unit_amount: number; // cents per seat
  flat_amount?: number;
}

interface PriceDef {
  lookup_key: string;
  interval: 'month' | 'year';
  tiers: TierDef[];
}

interface PlanDef {
  name: string;
  description: string;
  metadata: Record<string, string>;
  prices: PriceDef[];
}

const ON_PREM_PLANS: PlanDef[] = [
  {
    name: 'Self-hosted Starter', // OnPremPlanTitles.ENTERPRISE_STARTER
    description: 'Self-hosted NocoDB for small teams',
    metadata: {
      // Limits
      limit_workspace: '1',
      limit_snapshot: '0',
      // Features disabled (Enterprise-only per pricing CSV)
      feature_ai: 'false',
      feature_audit_workspace: 'false',
      feature_sso: 'false',
      feature_private_bases: 'false',
      feature_cell_colour: 'false',
      feature_team_management: 'false',
      feature_pinned_filter: 'false',
      feature_toggle_filter: 'false',
      feature_button_visibility: 'false',
      feature_rls: 'false',
      feature_scim: 'false',
      feature_view_sections: 'false',
      // Descriptions
      description_1: 'All EE features',
      description_2: 'Unlimited editors & records',
      description_3: 'AI & Workflows included',
      description_4: 'Email support',
    },
    prices: [
      {
        lookup_key: 'on_prem_starter_monthly', // OnPremPlanPriceLookupKeys.STARTER_MONTHLY
        interval: 'month',
        tiers: [
          { up_to: 'inf', unit_amount: 5000 },
        ],
      },
      {
        lookup_key: 'on_prem_starter_yearly', // OnPremPlanPriceLookupKeys.STARTER_YEARLY
        interval: 'year',
        tiers: [
          { up_to: 'inf', unit_amount: 48000 },
        ],
      },
    ],
  },
  {
    name: 'Self-hosted Enterprise', // OnPremPlanTitles.ENTERPRISE
    description: 'Self-hosted NocoDB for organizations',
    metadata: {
      description_1: 'Everything in Starter',
      description_2: 'SSO, SCIM & advanced security',
      description_3: 'Unlimited workspaces',
      description_4: 'Priority support',
    },
    prices: [
      {
        lookup_key: 'on_prem_enterprise_monthly', // OnPremPlanPriceLookupKeys.ENTERPRISE_MONTHLY
        interval: 'month',
        tiers: [
          { up_to: 'inf', unit_amount: 5400 }
        ],
      },
      {
        lookup_key: 'on_prem_enterprise_yearly', // OnPremPlanPriceLookupKeys.ENTERPRISE_YEARLY
        interval: 'year',
        tiers: [
          { up_to: 'inf', unit_amount: 54000 }
        ],
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
async function findExistingProduct(name: string): Promise<Stripe.Product | null> {
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

async function backendRequest(method: string, path: string, body?: Record<string, unknown>): Promise<{ ok: boolean; status: number; data: any }> {
  const res = await fetch(`${BACKEND_URL}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
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

function formatTierPrice(tier: TierDef, interval: string): string {
  const perSeat = tier.unit_amount / 100;
  const upTo = tier.up_to === 'inf' ? '∞' : tier.up_to;
  return `up_to=${upTo} → $${perSeat}/seat/${interval}`;
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n=== Seed On-Prem Plans ===\n');

  // 1. Verify Stripe connection
  console.log('  Checking Stripe connection...');
  try {
    await stripe.products.list({ limit: 1 });
    ok('Stripe connected');
  } catch (e: any) {
    fail(`Stripe connection failed: ${e.message}`);
    process.exit(1);
  }

  // 2. Verify backend is reachable
  console.log('  Checking backend connection...');
  try {
    const res = await fetch(`${BACKEND_URL}/api/v1/health`);
    if (!res.ok) throw new Error(`Health check returned ${res.status}`);
    ok(`Backend reachable at ${BACKEND_URL}`);
  } catch (e: any) {
    fail(`Backend not reachable at ${BACKEND_URL}: ${e.message}`);
    fail('Make sure the backend is running with NC_STRIPE_SECRET_KEY set');
    process.exit(1);
  }

  console.log('');

  // 3. Process each plan
  for (const planDef of ON_PREM_PLANS) {
    console.log(`[${planDef.name}]`);

    // 3a. Find or create Stripe product (by exact name match)
    let product = await findExistingProduct(planDef.name);

    if (product) {
      product = await stripe.products.update(product.id, {
        description: planDef.description,
        metadata: planDef.metadata,
      });
      ok(`Updated Stripe product: ${product.id}`);
    } else {
      product = await stripe.products.create({
        name: planDef.name,
        description: planDef.description,
        metadata: planDef.metadata,
      });
      ok(`Created Stripe product: ${product.id}`);
    }

    // 3b. Create tiered prices (skip if lookup_key already exists)
    for (const priceDef of planDef.prices) {
      const existing = await stripe.prices.list({
        lookup_keys: [priceDef.lookup_key],
        limit: 1,
      });

      if (existing.data.length > 0) {
        skip(`Price ${priceDef.lookup_key} already exists: ${existing.data[0].id}`);
        continue;
      }

      const stripeTiers: Stripe.PriceCreateParams.Tier[] = priceDef.tiers.map((t) => ({
        up_to: t.up_to === 'inf' ? 'inf' : t.up_to,
        unit_amount: t.unit_amount,
        flat_amount: t.flat_amount ?? 0,
      }));

      const price = await stripe.prices.create({
        product: product.id,
        currency: 'usd',
        billing_scheme: 'tiered',
        tiers_mode: 'volume',
        tiers: stripeTiers,
        recurring: {
          interval: priceDef.interval,
          usage_type: 'licensed',
        },
        lookup_key: priceDef.lookup_key,
      });

      ok(`Created tiered price ${priceDef.lookup_key}: ${price.id}`);
      for (const tier of priceDef.tiers) {
        console.log(`      ${formatTierPrice(tier, priceDef.interval)}`);
      }
    }

    // 3c. Register or sync plan in backend DB
    const createResult = await backendRequest('POST', '/api/internal/payment/plan', {
      stripe_product_id: product.id,
    });

    if (createResult.ok) {
      ok('Registered plan in database');
    } else if (createResult.data?.msg?.includes('already exists') || createResult.status === 409) {
      // Plan exists — sync to pick up metadata/price changes
      const syncResult = await backendRequest('PATCH', '/api/internal/payment/plan');
      if (syncResult.ok) {
        ok('Synced all plans from Stripe');
      } else {
        fail(`Failed to sync plans: ${JSON.stringify(syncResult.data)}`);
      }
    } else {
      fail(`Failed to register plan: ${JSON.stringify(createResult.data)}`);
    }

    console.log('');
  }

  console.log('=== Done ===\n');
}

main().catch((e) => {
  console.error('\nFatal error:', e.message);
  process.exit(1);
});
