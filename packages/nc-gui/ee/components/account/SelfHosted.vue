<script lang="ts" setup>
import type { Stripe, StripeEmbeddedCheckout } from '@stripe/stripe-js'
import { OnPremPlanMeta, type OnPremPlanTitles } from 'nocodb-sdk'

interface CheckoutSessionResult {
  client_secret: string
  payment_status: string
}

type ViewState = 'list' | 'plan-select' | 'checkout' | 'success'

const route = useRoute()
const router = useRouter()

const { t } = useI18n()

const { $e } = useNuxtApp()

const { licenses, isLoading, listLicenses, syncLicenses, createCheckoutSession, getCheckoutSession, getCustomerPortal } =
  useOnPremLicense()

const isSyncing = ref(false)

const onSyncLicenses = async () => {
  isSyncing.value = true
  try {
    const synced = await syncLicenses()
    if (synced > 0) {
      message.toast(t('msg.success.licensesSynced', { count: synced }))
    } else {
      message.toast(t('msg.info.licensesUpToDate'))
    }
  } finally {
    isSyncing.value = false
  }
}

const { loadStripe } = useStripe()

const viewState = ref<ViewState>('list')

const stripeInstance = ref<Stripe | null>(null)

const checkoutRef = ref<StripeEmbeddedCheckout | null>(null)

const checkoutLoading = ref(false)

const successLicense = ref<(typeof licenses.value)[0] | null>(null)

const instanceUrl = computed(() => (route.query.instance_url as string) || '')

const copiedKey = ref(false)

const revealedKeys = ref<Set<string>>(new Set())

const afterPayment = ref(!!route.query.afterPayment)

const sessionId = computed(() => route.query.session_id as string)

const planMeta = (title: OnPremPlanTitles) => OnPremPlanMeta[title] || null

const statusLabel = (status: string) => {
  switch (status?.toUpperCase()) {
    case 'ACTIVE':
      return t('general.active')
    case 'PENDING':
      return t('activity.pending')
    case 'SUSPENDED':
      return t('labels.suspended')
    default:
      return status
  }
}

const statusClassNormalized = (status: string) => statusClass(status?.toUpperCase())

const statusClass = (status: string) => {
  switch (status) {
    case 'ACTIVE':
      return 'bg-nc-bg-green-light text-nc-content-green-dark border-nc-border-green'
    case 'PENDING':
      return 'bg-nc-bg-orange-light text-nc-content-orange-dark border-nc-border-orange'
    case 'SUSPENDED':
      return 'bg-nc-bg-red-light text-nc-content-red-dark border-nc-border-red'
    default:
      return 'bg-nc-bg-gray-light text-nc-content-gray border-nc-border-gray-medium'
  }
}

const maskKey = (key: string) => {
  if (!key) return ''
  return `${key.slice(0, 6)}${'*'.repeat(16)}${key.slice(-4)}`
}

const toggleRevealKey = (licenseId: string) => {
  if (revealedKeys.value.has(licenseId)) {
    revealedKeys.value.delete(licenseId)
  } else {
    revealedKeys.value.add(licenseId)
  }
}

const copyKey = async (key: string) => {
  try {
    await navigator.clipboard.writeText(key)
    copiedKey.value = true
    message.toast(t('general.copied'))
    $e('c:on-prem:license:copy-key')
    setTimeout(() => {
      copiedKey.value = false
    }, 2000)
  } catch {
    message.toast(t('msg.error.copyToClipboardError'))
  }
}

const onBuyLicense = () => {
  $e('c:on-prem:license:buy')
  viewState.value = 'plan-select'
}

const onManageBilling = async () => {
  const result = await getCustomerPortal()
  if (result?.url) {
    window.open(result.url, '_blank')
  }
}

const initCheckout = async (planId: string, priceId: string, quantity: number = 1) => {
  viewState.value = 'checkout'
  checkoutLoading.value = true

  try {
    if (!stripeInstance.value) {
      stripeInstance.value = await loadStripe()
    }

    const session = await createCheckoutSession({
      plan_id: planId,
      price_id: priceId,
      quantity,
      instance_url: instanceUrl.value || undefined,
    })

    checkoutRef.value = await stripeInstance.value.initEmbeddedCheckout({
      clientSecret: (session as CheckoutSessionResult).client_secret,
    })

    await nextTick()
    checkoutRef.value.mount('#on-prem-checkout')
  } catch (e: any) {
    message.toast(await extractSdkResponseErrorMsg(e))
    viewState.value = 'plan-select'
  } finally {
    checkoutLoading.value = false
  }
}

const backToPlanSelect = async () => {
  await destroyCheckout()
  viewState.value = 'plan-select'
}

const destroyCheckout = async () => {
  if (!checkoutRef.value) return

  try {
    checkoutRef.value.unmount()
    await checkoutRef.value.destroy()
    checkoutRef.value = null
    // Allow Stripe embedded checkout iframe to fully tear down before re-rendering
    await new Promise((resolve) => setTimeout(resolve, 100))
  } catch {
    checkoutRef.value = null
  }
}

const handleAfterPayment = async () => {
  if (!sessionId.value) return

  try {
    const session = (await getCheckoutSession(sessionId.value)) as CheckoutSessionResult

    if (session?.payment_status === 'paid') {
      await listLicenses()

      // Find the newly created license (most recent)
      if (licenses.value.length > 0) {
        successLicense.value = licenses.value[0]
      }

      viewState.value = 'success'
      $e('a:on-prem:license:purchase')
    } else {
      message.toast(t('msg.error.paymentFailed'))
      viewState.value = 'list'
    }
  } catch {
    viewState.value = 'list'
  }

  // Clean up query params
  router.replace({ query: {} })
}

const backToList = async () => {
  await destroyCheckout()
  successLicense.value = null
  viewState.value = 'list'
  await listLicenses()
}

onMounted(async () => {
  if (afterPayment.value && sessionId.value) {
    await handleAfterPayment()
  } else {
    await listLicenses()
  }
})

onBeforeUnmount(async () => {
  await destroyCheckout()
})
</script>

<template>
  <div class="flex flex-col">
    <NcPageHeader>
      <template #icon>
        <GeneralIcon icon="ncServer" class="flex-none !h-5 !w-5" />
      </template>
      <template #title>
        {{ $t('title.selfHostedLicenses') }}
      </template>
    </NcPageHeader>
    <div class="h-full overflow-y-auto nc-scrollbar-thin">
      <div class="mx-auto mt-8 px-4 pb-16" :class="viewState === 'list' ? 'max-w-[640px]' : 'max-w-[960px]'">
        <!-- List View -->
        <template v-if="viewState === 'list'">
          <div v-if="isLoading" class="flex items-center justify-center py-20">
            <GeneralLoader size="xlarge" />
          </div>

          <div v-else-if="licenses.length === 0" class="flex flex-col items-center gap-4 py-20">
            <GeneralIcon icon="ncKey2" class="h-12 w-12 text-nc-content-gray-muted" />
            <div class="text-sm text-nc-content-gray-subtle text-center">
              {{ $t('labels.noSelfHostedLicenses') }}
            </div>
            <div class="flex items-center gap-3">
              <NcButton type="primary" size="small" @click="onBuyLicense">
                {{ $t('labels.buyYourFirstLicense') }}
              </NcButton>
            </div>
          </div>

          <div v-else class="flex flex-col gap-5">
            <div class="flex items-center justify-end gap-2">
              <NcButton
                type="text"
                size="small"
                :loading="isSyncing"
                :tooltip="$t('labels.syncFromStripe')"
                data-testid="nc-self-hosted-sync-btn"
                @click="onSyncLicenses"
              >
                <GeneralIcon icon="refresh" class="h-4 w-4" />
              </NcButton>
              <NcButton
                type="secondary"
                size="small"
                @click="onManageBilling"
              >
                {{ $t('labels.manageBilling') }}
              </NcButton>
              <NcButton
                type="primary"
                size="small"
                data-testid="nc-self-hosted-buy-btn"
                @click="onBuyLicense"
              >
                {{ $t('labels.buyNewLicense') }}
              </NcButton>
            </div>

            <div
              v-for="license in licenses"
              :key="license.id"
              class="border-1 border-nc-border-gray-medium rounded-2xl p-5 hover:border-nc-border-gray-dark transition-colors"
              data-testid="nc-self-hosted-license-card"
            >
              <div class="flex items-center gap-2 mb-3">
                <div
                  v-if="license.plan"
                  class="flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-semibold border-1"
                  :style="{
                    backgroundColor: planMeta(license.plan.title)?.badgeBgColor,
                    color: planMeta(license.plan.title)?.badgeTextColor,
                    borderColor: planMeta(license.plan.title)?.badgeTextColor,
                  }"
                >
                  <span class="opacity-70 font-normal">{{ $t('general.plan') }}:</span>
                  {{ $t(`objects.paymentPlan.${license.plan.title}`) }}
                </div>
                <div class="flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium border-1" :class="statusClassNormalized(license.status)">
                  <span class="opacity-70 font-normal">{{ $t('labels.status') }}:</span>
                  {{ statusLabel(license.status) }}
                </div>
                <div
                  v-if="license.subscription"
                  class="flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium border-1 border-nc-border-purple text-nc-content-purple-dark bg-nc-bg-purple-light"
                >
                  <span class="opacity-70">{{ $t('general.billing') }}:</span>
                  {{ license.subscription.period === 'year' ? $t('labels.annual') : $t('general.monthly') }}
                </div>
              </div>

              <div class="flex items-center bg-nc-bg-gray-light rounded-lg mb-3 h-10">
                <div class="flex-none px-3 py-2 text-xs font-medium text-nc-content-gray-subtle border-r-1 border-nc-border-gray-medium">
                  {{ $t('title.licenseKey') }}
                </div>
                <code class="nc-license-key-code flex-1 text-xs select-all break-all leading-5 px-3 py-2">
                  {{ revealedKeys.has(license.id) ? license.license_key : maskKey(license.license_key) }}
                </code>
                <div class="flex items-center gap-1 flex-none pr-2">
                  <NcButton
                    type="text"
                    size="xs"
                    class="!rounded-md !hover:bg-nc-bg-gray-medium"
                    :tooltip="revealedKeys.has(license.id) ? $t('general.hide') : $t('general.show')"
                    @click="toggleRevealKey(license.id)"
                  >
                    <GeneralIcon :icon="revealedKeys.has(license.id) ? 'ncEyeOff' : 'ncEye'" class="h-4 w-4" />
                  </NcButton>
                  <NcButton
                    type="text"
                    size="xs"
                    class="!rounded-md !hover:bg-nc-bg-gray-medium"
                    :tooltip="$t('general.copy')"
                    @click="copyKey(license.license_key)"
                  >
                    <GeneralIcon :icon="copiedKey ? 'ncCheck' : 'ncCopy'" class="h-4 w-4" />
                  </NcButton>
                </div>
              </div>

              <div class="flex items-center gap-1.5 text-xs text-nc-content-gray-subtle">
                <span>{{ $t('labels.createdBy') }} {{ license.licensed_to }}</span>
                <template v-if="license.min_seats > 1">
                  <span>|</span>
                  <span>{{ license.min_seats }} {{ $t('general.seats') }}</span>
                </template>
                <template v-if="license.created_at">
                  <span>|</span>
                  <span>{{ $t('labels.createdOn') }} {{ new Date(license.created_at).toLocaleDateString() }}</span>
                </template>
              </div>
            </div>
          </div>
        </template>

        <!-- Plan Select View -->
        <template v-if="viewState === 'plan-select'">
          <div class="mb-6">
            <NcButton type="text" size="small" class="!-ml-2" @click="backToList">
              <div class="flex items-center gap-1">
                <GeneralIcon icon="ncArrowLeft" class="h-4 w-4" />
                {{ $t('labels.back') }}
              </div>
            </NcButton>
          </div>

          <div v-if="instanceUrl" class="p-3 rounded-lg bg-nc-bg-gray-light border border-nc-border-gray-medium mb-6">
            <div class="text-xs text-nc-content-gray-subtle mb-1">{{ $t('labels.instanceUrl') }}</div>
            <div class="text-sm font-medium break-all">{{ instanceUrl }}</div>
          </div>

          <AccountSelfHostedPlanSelector @select="initCheckout" />
        </template>

        <!-- Checkout View -->
        <template v-if="viewState === 'checkout'">
          <div class="mb-6">
            <NcButton type="text" size="small" class="!-ml-2" @click="backToPlanSelect">
              <div class="flex items-center gap-1">
                <GeneralIcon icon="ncArrowLeft" class="h-4 w-4" />
                {{ $t('labels.back') }}
              </div>
            </NcButton>
          </div>

          <div v-if="checkoutLoading" class="relative min-h-[40vh]">
            <div class="flex items-center justify-center py-20">
              <GeneralLoader size="xlarge" />
            </div>
          </div>

          <div v-show="!checkoutLoading" id="on-prem-checkout" class="w-full pb-10" />
        </template>

        <!-- Success View -->
        <template v-if="viewState === 'success' && successLicense">
          <div class="flex flex-col items-center gap-6 py-10">
            <div class="w-full max-w-[560px] border-1 border-nc-border-gray-medium rounded-2xl p-8 flex flex-col items-center gap-5">
              <div class="w-16 h-16 rounded-full bg-nc-bg-green-light flex items-center justify-center">
                <GeneralIcon icon="ncCheck" class="h-8 w-8 text-nc-content-green-dark" />
              </div>

              <div class="text-center">
                <div class="text-xl font-semibold mb-2">
                  {{
                    successLicense.plan
                      ? $t('title.licenseReadyWithPlan', { plan: $t(`objects.paymentPlan.${successLicense.plan.title}`) })
                      : $t('title.licenseReady')
                  }}
                </div>
                <div class="text-sm text-nc-content-gray-subtle">
                  {{ $t('labels.licenseReadyDescription') }}
                </div>
              </div>

              <div class="flex items-center w-full bg-nc-bg-gray-light rounded-lg h-10">
                <div class="flex-none px-3 py-2 text-xs font-medium text-nc-content-gray-subtle border-r-1 border-nc-border-gray-medium">
                  {{ $t('title.licenseKey') }}
                </div>
                <code
                  class="nc-license-key-code flex-1 text-sm px-3 py-2 select-all break-all"
                  data-testid="nc-self-hosted-success-key"
                >
                  {{ successLicense.license_key }}
                </code>
              </div>

              <div class="flex items-center gap-3 w-full">
                <NcButton
                  :type="copiedKey ? 'secondary' : 'primary'"
                  size="small"
                  class="!flex-1"
                  @click="copyKey(successLicense.license_key)"
                >
                  <div class="flex items-center gap-1">
                    <GeneralIcon :icon="copiedKey ? 'ncCheck' : 'ncCopy'" class="h-4 w-4" />
                    {{ copiedKey ? $t('general.copied') : $t('labels.copyLicenseKey') }}
                  </div>
                </NcButton>
                <NcButton type="secondary" size="small" class="!flex-1" @click="backToList">
                  {{ $t('labels.viewAllLicenses') }}
                </NcButton>
              </div>
            </div>

            <div v-if="instanceUrl" class="w-full max-w-[560px] p-4 rounded-lg bg-nc-bg-gray-light text-center">
              <div class="text-sm text-nc-content-gray-subtle">
                {{ $t('labels.goBackToInstance', { url: instanceUrl }) }}
              </div>
            </div>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>

<style lang="scss">
.nc-license-key-code {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;
}
</style>
