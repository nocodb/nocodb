import { type Stripe } from '@stripe/stripe-js'
import { loadStripe as _loadStripe } from '@stripe/stripe-js'

export const useStripe = createSharedComposable(() => {
  const { appInfo } = useGlobal()

  const stripe = ref<Stripe | null>(null)

  const loadStripe = async (): Promise<Stripe> => {
    if (!stripe.value) {
      stripe.value = (await _loadStripe(appInfo.value.stripePublishableKey!)) as Stripe
    }

    return stripe.value
  }

  onMounted(() => {
    if (appInfo.value.stripePublishableKey) {
      loadStripe()
    }
  })

  return {
    loadStripe,
  }
})
