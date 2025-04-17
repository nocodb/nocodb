<script lang="ts" setup>
import type { Stripe, StripeEmbeddedCheckout } from '@stripe/stripe-js'
import { loadStripe } from '@stripe/stripe-js'

const route = useRoute()

const stripe = ref<Stripe | null>(null)

const redirectRef = ref<'billing' | 'pricing' | null>(null)

const { hideSidebar, showTopbar } = storeToRefs(useSidebarStore())

const { appInfo } = useGlobal()

const { navigateToPricing, navigateToBilling } = useEeConfig()

const { createPaymentForm, selectedPlan, paymentState, paymentMode, loadPlan, activeWorkspace, loadWorkspaceSeatCount } =
  useProvidePaymentStore()

const isLoading = ref(false)

const checkout = ref<StripeEmbeddedCheckout | null>(null)

const onBack = () => {
  if (redirectRef.value === 'billing') {
    navigateToBilling()
  } else {
    navigateToPricing()
  }
}

const initializeForm = async () => {
  try {
    const res: {
      client_secret?: string
      recover?: boolean
    } = await createPaymentForm()

    if (res.recover) {
      message.info(`Your subscription has been recovered.`)
      window.location.reload()
      return
    }

    // Initialize Checkout
    checkout.value = await stripe.value!.initEmbeddedCheckout({
      clientSecret: res.client_secret,
    })

    // Mount Checkout
    checkout.value.mount('#checkout')
  } catch (err: any) {
    console.log(err)
    onBack()
  } finally {
    isLoading.value = false
  }
}

onMounted(() => {
  hideSidebar.value = true
  showTopbar.value = true
  isLoading.value = true

  if (!appInfo.value.stripePublishableKey) {
    message.error('Stripe publishable key not found')
    return
  }

  try {
    redirectRef.value = route.query?.ref === 'billing' ? 'billing' : null

    paymentMode.value = route.query?.paymentMode === 'month' ? 'month' : 'year'

    loadStripe(appInfo.value.stripePublishableKey).then((s) => {
      stripe.value = s

      loadWorkspaceSeatCount().then(() => {
        loadPlan(route.params.planId as string).then((plan) => {
          if (!plan) {
            navigateToPricing()
            message.error('Plan not found')
            return
          }

          selectedPlan.value = plan
          paymentState.value = PaymentState.PAYMENT

          initializeForm()
        })
      })
    })
  } catch (err) {
    onBack()
  }
})

onBeforeUnmount(() => {
  hideSidebar.value = false
  showTopbar.value = false

  if (checkout.value) {
    checkout.value.unmount()
    checkout.value.destroy()
    checkout.value = null
  }
})
</script>

<template>
  <div v-if="selectedPlan" class="flex flex-col w-full justify-center mt-[52px]">
    <div class="flex flex-col w-full gap-6">
      <div class="nc-payment-pay-header sticky top-0 bg-white py-3 -mt-6 -mx-6">
        <div class="max-w-[888px] mx-auto flex items-center justify-between">
          <div v-if="paymentState && paymentState !== PaymentState.SELECT_PLAN" class="flex">
            <NcButton
              type="text"
              size="small"
              inner-class="!gap-1"
              class="!text-nc-content-brand !hover:text-brand-600"
              @click="onBack"
            >
              <template #icon>
                <GeneralIcon icon="chevronLeft" class="h-4 w-4" />
              </template>
              <div>{{ $t('labels.back') }}</div>
            </NcButton>
          </div>
          <div class="text-2xl text-nc-content-gray-emphasis font-weight-700 flex">
            {{
              $t('title.upgradeWorkspaceToPlan', {
                workspace: activeWorkspace?.title ?? 'Workspace',
                plan: $t(`objects.paymentPlan.${selectedPlan.title}`),
              })
            }}
          </div>
          <div v-if="paymentState && paymentState !== PaymentState.SELECT_PLAN" class="flex invisible">
            <NcButton type="text" size="small" inner-class="!gap-1" class="!text-nc-content-brand !hover:text-brand-600">
              <template #icon>
                <GeneralIcon icon="chevronLeft" class="h-4 w-4" />
              </template>
              <div>{{ $t('labels.back') }}</div>
            </NcButton>
          </div>
        </div>
      </div>
      <div v-if="isLoading" class="relative h-[600px]">
        <PaymentSkeleton class="w-full" />
      </div>
      <div v-show="!isLoading" id="checkout" class="w-full h-[600px]">
        <!-- Checkout inserts the payment form here -->
      </div>
    </div>
  </div>
</template>

<style lang="scss">
.nc-payment-billing-page {
  &.nc-scrolled-to-bottom {
    .nc-payment-pay-header {
      @apply border-b border-nc-border-gray-medium;
    }
  }
}
</style>
