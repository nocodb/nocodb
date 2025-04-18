import Stripe from 'stripe';

const stripe = new Stripe('sk_test_51QhRouHU2WPCjTxweMUynOZZFBCuPYvvRq9uUSMCdN8O8s65XQuNotWpINQQMqxnUTpcjSXArv8vd5C4XIIsOOEW00OBPNYSah');

async function createProduct(name, metadata) {
  const product = await stripe.products.create({
    name,
    metadata,
    tax_code: 'txcd_10103001',
  });

  console.log(`Created product: ${name} -> ${product.id}`);
  return product.id;
}

async function createPrice(
  productId,
  nickname,
  lookup_key,
  unitAmount,
  interval,
  upTo
) {
  const price = await stripe.prices.create({
    product: productId,
    nickname,
    lookup_key,
    currency: 'usd',
    billing_scheme: 'tiered',
    tiers_mode: 'graduated',
    recurring: {
      interval,
      usage_type: 'licensed',
    },
    tiers: [
      {
        unit_amount: unitAmount,
        up_to: upTo,
      },
      {
        unit_amount: 0,
        up_to: 'inf',
      },
    ],
  });

  console.log(`Created price: ${nickname} -> ${price.id}`);
}

async function populatePlans() {
  try {
    const teamMetadata = {
      description_1: 'Unlimited editors',
      description_2: '50,000 rows per workspace',
      description_3: '20 GB of attachments per workspace',
      description_4: '10,000 automation runs',
      description_5: '100,000 API calls per month',
      description_6: 'SAML-based single sign-on',
      feature_ai: 'true',
      feature_ai_integrations: 'false',
      feature_at_mention: 'true',
      feature_audit_workspace: 'false',
      feature_comment_resolve: 'true',
      feature_custom_url: 'true',
      feature_discussion_mode: 'true',
      feature_extensions: 'true',
      feature_file_mode: 'true',
      feature_form_custom_logo: 'true',
      feature_form_field_on_condition: 'true',
      feature_form_field_validation: 'true',
      feature_group_by_aggregations: 'true',
      feature_hide_branding: 'true',
      feature_ltar_limit_selection_by_filter: 'true',
      feature_personal_views: 'true',
      feature_scripts: 'true',
      feature_sso: 'true',
      feature_webhook_custom_payload: 'true',
      limit_ai_token: '10000',
      limit_api_call: '100000',
      limit_audit_retention: '60',
      limit_automation_retention: '7',
      limit_automation_run: '10000',
      limit_editor: '-1',
      limit_external_source: '1',
      limit_record: '50000',
      limit_snapshot: '2',
      limit_storage: '20000',
    };

    const businessMetadata = {
      description_1: '300,000 rows per workspace',
      description_2: '100 GB of attachments per workspace',
      description_3: '50,000 automation runs',
      description_4: '1,000,000 API calls per month',
      description_5: 'Audit logs',
      feature_ai: 'true',
      feature_ai_integrations: 'true',
      feature_at_mention: 'true',
      feature_audit_workspace: 'true',
      feature_automation_logs: 'true',
      feature_comment_resolve: 'true',
      feature_custom_url: 'true',
      feature_discussion_mode: 'true',
      feature_extensions: 'true',
      feature_file_mode: 'true',
      feature_form_custom_logo: 'true',
      feature_form_field_on_condition: 'true',
      feature_form_field_validation: 'true',
      feature_group_by_aggregations: 'true',
      feature_hide_branding: 'true',
      feature_ltar_limit_selection_by_filter: 'true',
      feature_personal_views: 'true',
      feature_scripts: 'true',
      feature_sso: 'true',
      feature_webhook_custom_payload: 'true',
      limit_ai_token: '10000',
      limit_api_call: '1000000',
      limit_audit_retention: '180',
      limit_automation_call: '50000',
      limit_automation_retention: '90',
      limit_editor: '-1',
      limit_external_source: '10',
      limit_record: '300000',
      limit_snapshot: '5',
      limit_storage: '100000',
    };

    const teamProductId = await createProduct('Team', teamMetadata);
    const businessProductId = await createProduct('Business', businessMetadata);

    await createPrice(teamProductId, 'Team Monthly', 'team_monthly', 1500, 'month', 9);
    await createPrice(teamProductId, 'Team Yearly', 'team_yearly', 14400, 'year', 9);

    await createPrice(teamProductId, 'Loyalty Team Monthly', 'loyalty_team_monthly', 1500, 'month', 4);
    await createPrice(teamProductId, 'Loyalty Team Yearly', 'loyalty_team_yearly', 14400, 'year', 4);

    await createPrice(businessProductId, 'Business Monthly', 'business_monthly', 3000, 'month', 9);
    await createPrice(businessProductId, 'Business Yearly', 'business_yearly', 28800, 'year', 9);

    await createPrice(businessProductId, 'Loyalty Business Monthly', 'loyalty_business_monthly', 3000, 'month', 4);
    await createPrice(businessProductId, 'Loyalty Business Yearly', 'loyalty_business_yearly', 28800, 'year', 4);

    console.log('Done populating plans & prices');
  } catch (err) {
    console.error(err);
  }
}

populatePlans();
