<script lang="ts" setup>
import { OnPremPlanTitles } from 'nocodb-sdk'

interface Props {
  initialSeats?: number
}

const props = withDefaults(defineProps<Props>(), {
  initialSeats: 0,
})

const emit = defineEmits<{
  (e: 'select', planId: string, priceId: string, quantity: number): void
}>()

const { t } = useI18n()

const { plans, paymentMode, loadPlans, getPlanPrice, getPlanPriceAmount } = useOnPremLicense()

const isLoadingPlans = ref(false)

const seatCount = computed(() => Math.max(1, props.initialSeats || 0))

const scaleSeatCount = computed(() => Math.max(3, seatCount.value))

const isFromInstance = computed(() => (props.initialSeats ?? 0) > 1)

const businessPlan = computed(() => plans.value.find((p) => p.title === OnPremPlanTitles.SELF_HOSTED_BUSINESS) ?? null)

const scalePlan = computed(() => plans.value.find((p) => p.title === OnPremPlanTitles.SELF_HOSTED_SCALE) ?? null)

interface Feature {
  label: string
  tooltip?: {
    title: string
    items: string[]
    footer: string
  }
  soon?: boolean
}

const businessFeatures: Feature[] = [
  {
    label: 'SAML based Single Sign-On 🚀',
    tooltip: {
      title: 'SSO that just works with your stack',
      items: [
        'Protocols: SAML 2.0, OpenID Connect, OAuth',
        'IdPs: Okta, Azure AD, Google Workspace, OneLogin, Keycloak, Auth0',
        'Auto-provision users from your IdP',
      ],
      footer: 'Whatever your IT team uses, NocoDB speaks it!',
    },
  },
  {
    label: 'Workflows, Scripts & Dashboards',
    tooltip: {
      title: 'Automate the busywork. Visualize the rest.',
      items: [
        'Trigger workflows on record changes',
        'Run custom scripts to extend NocoDB',
        'Build dashboards from any table or view',
      ],
      footer: 'One workspace for data, automation & insights!',
    },
  },
  {
    label: 'Table Level Permissions',
    tooltip: {
      title: 'Lock down entire tables by role',
      items: [
        'Allow or deny access per role, team, or user',
        'Hide sensitive tables from view entirely',
        'Separate read, edit, and delete rights',
      ],
      footer: 'The right table, for the right people. Always!',
    },
  },
  {
    label: 'Field Level Permissions',
    tooltip: {
      title: 'Show or hide columns by role',
      items: [
        'Salary, SSN, contracts: visible to HR only',
        'Read-only for some, editable for others',
        'Real column-level access, not a hidden view',
      ],
      footer: 'No more "hidden" views that still leak data!',
    },
  },
  {
    label: 'Teams',
    tooltip: {
      title: 'Manage users in groups, not one-by-one',
      items: [
        'Group collaborators into a single access unit',
        'Assign a workspace or base role once, everyone inherits it',
        'Change a role on the team, propagate to every member',
      ],
      footer: 'Onboard a 20-person team in seconds, not 20 separate clicks!',
    },
  },
  {
    label: 'Sync Data From External Apps',
    tooltip: {
      title: 'All your SaaS data, in one workspace',
      items: [
        'Pull from Jira, GitHub, GitLab, Zendesk & more',
        'Issues, tickets, PRs land in NocoDB tables',
        'Mix with your own data for cross-tool reports',
      ],
      footer: 'Stop tab-hopping. Build with the data you already have!',
    },
  },
  {
    label: 'Single-provider AI',
    tooltip: {
      title: 'AI fields, powered by your provider of choice',
      items: [
        'Connect OpenAI, Anthropic, Google, or any compatible API',
        'Power AI fields, summaries, and classification',
        'Your API key, your billing, your data',
      ],
      footer: 'Bring the model you already use!',
    },
  },
  { label: 'Email support' },
]

const scaleFeatures: Feature[] = [
  { label: '3 minimum seats' },
  { label: 'Unlimited workspaces' },
  {
    label: 'Audit Logs',
    tooltip: {
      title: 'Know exactly who did what, and when',
      items: [
        'Every change tracked: the who, the what, the when',
        'Answer "who deleted this?" in seconds, not days',
        'The paper trail auditors, security, and legal will ask for',
      ],
      footer: 'When something goes wrong, this is the difference between an answer and a guess!',
    },
  },
  {
    label: 'Row level security',
    tooltip: {
      title: 'Pick exactly which rows each user sees',
      items: [
        'Scope record access by role, team, or user',
        'Sales reps see their accounts. Managers see all',
        'Same table, different views per audience',
      ],
      footer: 'Real record-level access control. No SQL, no workarounds!',
    },
  },
  {
    label: 'Team hierarchy',
    tooltip: {
      title: 'Nest teams to match your org chart',
      items: [
        'Create sub-teams under any parent team',
        'Access flows naturally from leadership down',
        'Reorganize on the fly, move teams under new parents',
      ],
      footer: 'Mirror your real org structure, not a flat list of users!',
    },
  },
  {
    label: 'Multi-provider AI',
    tooltip: {
      title: 'Mix any AI providers, all in one workspace',
      items: [
        'OpenAI for generation, Claude for analysis, Ollama for sensitive data',
        'Different teams pick different models',
        'Route by cost, capability, or compliance',
      ],
      footer: 'Best model for each job. No vendor lock-in!',
    },
  },
  { label: 'Email support' },
]

const enterpriseFeatures: Feature[] = [
  { label: 'SCIM' },
  { label: 'Air gapped installation' },
  { label: 'Onboarding support' },
  { label: 'Priority support' },
  { label: 'Invoice based payments' },
  { label: 'Base Sandbox', soon: true },
  { label: 'Whitelabeling', soon: true },
]

const selectBusiness = () => {
  if (!businessPlan.value) return
  const price = getPlanPrice(businessPlan.value, paymentMode.value)
  if (!price) {
    message.error(t('msg.error.priceNotFound'))
    return
  }
  emit('select', businessPlan.value.id, price.id, seatCount.value)
}

const selectScale = () => {
  if (!scalePlan.value) return
  const price = getPlanPrice(scalePlan.value, paymentMode.value)
  if (!price) {
    message.error(t('msg.error.priceNotFound'))
    return
  }
  emit('select', scalePlan.value.id, price.id, scaleSeatCount.value)
}

onMounted(async () => {
  if (plans.value.length === 0) {
    isLoadingPlans.value = true
    await loadPlans()
    isLoadingPlans.value = false
  }
})
</script>

<template>
  <div class="flex flex-col">
    <!-- Billing period toggle -->
    <div class="flex items-center justify-center mb-6">
      <PaymentPlansSelectMode v-model:value="paymentMode" :discount="20" />
    </div>

    <div v-if="isLoadingPlans" class="flex items-center justify-center py-10">
      <GeneralLoader size="xlarge" />
    </div>

    <template v-else>
      <!-- Auto-bill notice -->
      <div class="nc-seat-info-panel" data-testid="nc-self-hosted-seat-info">
        <div class="flex items-start gap-3">
          <GeneralIcon icon="ncInfo" class="flex-none w-4 h-4 mt-0.5 text-nc-content-brand" />
          <div class="text-sm text-nc-content-gray leading-5">
            {{
              isFromInstance
                ? $t('labels.seatBillingNoteFromInstance', { count: seatCount }, seatCount)
                : $t('labels.seatBillingNoteDefault')
            }}
          </div>
        </div>
      </div>

      <!-- Plan cards -->
      <div class="grid grid-cols-3 gap-6 mt-6">
        <!-- Business — popular (self-serve) -->
        <div v-if="businessPlan" class="nc-plan-card nc-plan-card-popular" data-testid="nc-self-hosted-plan-business">
          <h3 class="nc-plan-title">Business</h3>
          <div class="nc-plan-subtitle">For Your Business Needs</div>

          <div class="nc-plan-price-row">
            <span class="nc-plan-price-sign">$</span>
            <span class="nc-plan-price-amount">{{ getPlanPriceAmount(businessPlan) }}</span>
            <span class="nc-plan-price-unit">
              per editor / month,<br />
              {{ paymentMode === 'year' ? $t('labels.billedAnnuallyLower') : $t('labels.billedMonthly') }}
            </span>
          </div>

          <div class="nc-plan-tagline-pill">Save up to 70% vs Airtable, Monday &amp; Smartsheet</div>

          <div class="nc-plan-seat-total">
            <span class="text-nc-content-gray-subtle">{{ $t('labels.fromNSeats', { count: seatCount }) }}</span>
            <span class="font-semibold text-nc-content-gray-emphasis">
              ${{ getPlanPriceAmount(businessPlan) * seatCount
              }}<span class="font-normal text-nc-content-gray-muted">{{ $t('labels.perMonth') }}</span>
            </span>
          </div>

          <div class="nc-plan-section-header invisible" aria-hidden="true">&nbsp;</div>

          <div class="nc-plan-feature-list">
            <div v-for="feat in businessFeatures" :key="feat.label" class="nc-plan-feature-item">
              <GeneralIcon icon="circleCheckSolid" class="nc-plan-feature-check" />
              <NcTooltip v-if="feat.tooltip" placement="top" overlay-class-name="nc-plan-feature-tooltip">
                <template #title>
                  <div class="nc-plan-feature-tooltip-title">{{ feat.tooltip.title }}</div>
                  <ul class="nc-plan-feature-tooltip-list">
                    <li v-for="item in feat.tooltip.items" :key="item">{{ item }}</li>
                  </ul>
                  <div class="nc-plan-feature-tooltip-footer">{{ feat.tooltip.footer }}</div>
                </template>
                <span class="nc-plan-feature-trigger">{{ feat.label }}</span>
              </NcTooltip>
              <span v-else>{{ feat.label }}</span>
            </div>
          </div>

          <div class="nc-plan-cta">
            <NcButton
              type="primary"
              size="medium"
              class="!w-full"
              data-testid="nc-self-hosted-plan-business-buy"
              @click.stop="selectBusiness"
            >
              Choose Business
            </NcButton>
          </div>
        </div>

        <!-- Scale (self-serve, min 3 seats) -->
        <div v-if="scalePlan" class="nc-plan-card" data-testid="nc-self-hosted-plan-scale">
          <h3 class="nc-plan-title">Scale</h3>
          <div class="nc-plan-subtitle">For Growing Teams</div>

          <div class="nc-plan-price-row">
            <span class="nc-plan-price-sign">$</span>
            <span class="nc-plan-price-amount">{{ getPlanPriceAmount(scalePlan) }}</span>
            <span class="nc-plan-price-unit">
              per editor / month,<br />
              {{
                paymentMode === 'year'
                  ? $t('labels.billedAnnuallyMinSeats', { count: 3 })
                  : $t('labels.billedMonthlyMinSeats', { count: 3 })
              }}
            </span>
          </div>

          <div class="nc-plan-tagline-pill">Fast-moving teams with budget.<br />No sales call needed.</div>

          <div class="nc-plan-seat-total">
            <span class="text-nc-content-gray-subtle">{{ $t('labels.fromNSeats', { count: scaleSeatCount }) }}</span>
            <span class="font-semibold text-nc-content-gray-emphasis">
              ${{ getPlanPriceAmount(scalePlan) * scaleSeatCount
              }}<span class="font-normal text-nc-content-gray-muted">{{ $t('labels.perMonth') }}</span>
            </span>
          </div>

          <div class="nc-plan-section-header">Everything in Business and</div>

          <div class="nc-plan-feature-list">
            <div v-for="feat in scaleFeatures" :key="feat.label" class="nc-plan-feature-item">
              <GeneralIcon icon="circleCheckSolid" class="nc-plan-feature-check" />
              <NcTooltip v-if="feat.tooltip" placement="top" overlay-class-name="nc-plan-feature-tooltip">
                <template #title>
                  <div class="nc-plan-feature-tooltip-title">{{ feat.tooltip.title }}</div>
                  <ul class="nc-plan-feature-tooltip-list">
                    <li v-for="item in feat.tooltip.items" :key="item">{{ item }}</li>
                  </ul>
                  <div class="nc-plan-feature-tooltip-footer">{{ feat.tooltip.footer }}</div>
                </template>
                <span class="nc-plan-feature-trigger">{{ feat.label }}</span>
              </NcTooltip>
              <span v-else>{{ feat.label }}</span>
            </div>
          </div>

          <div class="nc-plan-cta">
            <NcButton
              type="secondary"
              size="medium"
              class="!w-full"
              data-testid="nc-self-hosted-plan-scale-buy"
              @click.stop="selectScale"
            >
              Choose Scale
            </NcButton>
          </div>
        </div>

        <!-- Enterprise — contact sales only -->
        <div class="nc-plan-card" data-testid="nc-self-hosted-plan-enterprise">
          <h3 class="nc-plan-title">Enterprise</h3>
          <div class="nc-plan-subtitle">Tailored to Your Organization</div>

          <div class="nc-plan-price-row">
            <span class="nc-plan-price-enterprise-text">Schedule a Call</span>
          </div>

          <div class="nc-plan-tagline-pill nc-plan-tagline-pill-compact">
            Trusted in Defense, Finance,<br />Healthcare &amp; Publicly Trading Companies
          </div>

          <div class="nc-plan-seat-total invisible" aria-hidden="true">&nbsp;</div>

          <div class="nc-plan-section-header">Everything in Scale and</div>

          <div class="nc-plan-feature-list">
            <div v-for="feat in enterpriseFeatures" :key="feat.label" class="nc-plan-feature-item">
              <GeneralIcon icon="circleCheckSolid" class="nc-plan-feature-check" />
              <span> {{ feat.label }}<span v-if="feat.soon" class="nc-plan-feature-soon"> (soon)</span> </span>
            </div>
          </div>

          <div class="nc-plan-cta">
            <NcButton
              type="secondary"
              size="medium"
              class="!w-full"
              data-testid="nc-self-hosted-plan-enterprise-contact"
              @click="navigateTo('https://cal.com/nocodb/sales', { external: true, open: { target: '_blank' } })"
            >
              <div class="flex items-center gap-1.5">
                <GeneralIcon icon="ncMail" class="h-4 w-4" />
                {{ $t('labels.contactSales') }}
              </div>
            </NcButton>
          </div>
        </div>
      </div>
    </template>

    <!-- Help & FAQ -->
    <NcDivider class="!my-8" />

    <div class="grid grid-cols-2 gap-6">
      <div class="flex flex-col gap-3">
        <div class="text-sm font-semibold text-nc-content-gray-emphasis">
          {{ $t('title.helpAndSupport') }}
        </div>
        <div class="text-sm text-nc-content-gray-subtle">
          {{ $t('title.helpAndSupportSubtitle') }}
        </div>
        <div>
          <NcButton
            type="secondary"
            size="small"
            @click="navigateTo('https://cal.com/nocodb/sales', { external: true, open: { target: '_blank' } })"
          >
            <div class="flex items-center gap-1.5">
              <GeneralIcon icon="ncMail" class="h-4 w-4" />
              {{ $t('labels.contactSales') }}
            </div>
          </NcButton>
        </div>
      </div>

      <div class="flex flex-col gap-3">
        <div class="text-sm font-semibold text-nc-content-gray-emphasis">
          {{ $t('title.faq') }}
        </div>
        <div class="text-sm text-nc-content-gray-subtle">
          {{ $t('title.faqSubtitle') }}
        </div>
        <div>
          <NcButton
            type="secondary"
            size="small"
            @click="navigateTo('https://nocodb.com/pricing#faq', { external: true, open: { target: '_blank' } })"
          >
            <div class="flex items-center gap-1.5">
              <GeneralIcon icon="ncExternalLink" class="h-4 w-4" />
              {{ $t('activity.goToPage') }}
            </div>
          </NcButton>
        </div>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
/* ── Seat info panel ── */
.nc-seat-info-panel {
  @apply py-3 px-4 rounded-lg border-1 border-nc-border-brand bg-nc-bg-brand;
}

/* ── Plan card ── */
.nc-plan-card {
  @apply flex flex-col p-5 rounded-2xl border-1 border-nc-border-gray-medium bg-white transition-all duration-300;

  &:hover {
    box-shadow: 0 0 8px 0 rgba(0, 0, 0, 0.06);
  }
}

.nc-plan-card-popular {
  border-color: #3366ff;
  box-shadow: 0 0 0 4px rgba(41, 82, 204, 0.08);

  &:hover {
    box-shadow: 0 0 0 4px rgba(41, 82, 204, 0.08), 0 0 8px 0 rgba(0, 0, 0, 0.06);
  }
}

/* ── Title & subtitle ── */
.nc-plan-title {
  @apply text-[20px] leading-8 font-bold text-nc-content-gray-emphasis m-0;
}

.nc-plan-subtitle {
  @apply text-[13px] leading-[18px] font-medium text-nc-content-gray-subtle mt-1;
}

/* ── Price row ── */
.nc-plan-price-row {
  @apply flex items-center gap-1 mt-4 min-h-[40px];
}

.nc-plan-price-sign {
  @apply text-xl font-semibold leading-8 text-nc-content-gray-emphasis;
}

.nc-plan-price-amount {
  @apply text-[36px] leading-[36px] font-bold text-nc-content-gray-emphasis;
}

.nc-plan-price-unit {
  @apply text-xs leading-[18px] text-nc-content-gray-muted ml-1;
}

.nc-plan-price-enterprise-text {
  @apply text-[24px] leading-8 font-bold text-nc-content-gray-emphasis;
}

/* ── Lavender tagline pill ── */
.nc-plan-tagline-pill {
  @apply mt-4 py-3 px-4 rounded-xl text-[13px] leading-[18px] font-semibold;
  background-image: linear-gradient(90deg, #f0f3ff, #f3ecfa);
  color: #7d26cd;
  min-height: 70px;
  display: flex;
  align-items: center;
}

.nc-plan-tagline-pill-compact {
  @apply text-[11px] leading-[15px];
}

/* ── Seat total summary ── */
.nc-plan-seat-total {
  @apply flex items-center justify-between mt-3 text-xs;
}

.nc-plan-seat-total-placeholder {
  @apply justify-start;
}

/* ── Section header & features ── */
.nc-plan-section-header {
  @apply mt-4 text-sm font-semibold text-nc-content-gray-emphasis;
}

.nc-plan-feature-list {
  @apply flex flex-col gap-2.5 mt-3;
}

.nc-plan-feature-item {
  @apply flex items-start gap-2 text-sm text-nc-content-gray;
}

.nc-plan-feature-check {
  @apply flex-none w-4 h-4 mt-0.5 text-nc-content-green-dark;
}

.nc-plan-feature-soon {
  @apply text-xs text-nc-content-gray-muted;
}

.nc-plan-feature-trigger {
  text-decoration: underline dotted;
  text-underline-offset: 3px;
  text-decoration-color: var(--nc-border-gray-medium);
  cursor: help;
}

/* ── CTA ── */
.nc-plan-cta {
  @apply mt-auto pt-5 flex flex-col;
}
</style>

<style lang="scss">
/* Unscoped — ant-design portals tooltip overlays outside the component tree. */
.nc-plan-feature-tooltip {
  max-width: 280px;

  .ant-tooltip-inner {
    padding: 12px 14px;
    border-radius: 10px;
  }

  .nc-plan-feature-tooltip-title {
    font-size: 13px;
    font-weight: 700;
    line-height: 18px;
    margin-bottom: 6px;
  }

  .nc-plan-feature-tooltip-list {
    margin: 0 0 6px;
    padding-left: 16px;
    list-style: disc;

    li {
      font-size: 12px;
      line-height: 17px;
      margin-bottom: 2px;
    }
  }

  .nc-plan-feature-tooltip-footer {
    font-size: 12px;
    font-style: italic;
    opacity: 0.85;
    padding-top: 6px;
    border-top: 1px solid rgba(255, 255, 255, 0.12);
  }
}
</style>
