import { acceptHMRUpdate, defineStore } from 'pinia'
import type { CreditBalanceType, CreditLedgerRowType, CreditPackType } from 'nocodb-sdk'

export const useCredits = defineStore('creditsStore', () => {
  const balance = ref<CreditBalanceType | null>(null)

  const packs = ref<CreditPackType[]>([])

  const ledger = ref<CreditLedgerRowType[]>([])

  const isLoadingBalance = ref(false)

  const isLoadingLedger = ref(false)

  const ledgerIsLastPage = ref(true)

  const creditsEnabled = computed(() => false)

  const available = computed(() => 0)

  const isLowBalance = computed(() => false)

  const blockAiCredits = computed(() => false)

  const loadBalance = async () => {}

  const loadPacks = async () => {}

  const loadLedger = async (..._args: any[]) => {}

  const createTopupCheckout = async (
    ..._args: any[]
  ): Promise<{ client_secret?: string; checkout_url?: string; session_id: string } | null> => null

  const verifyTopup = async (..._args: any[]): Promise<{ fulfilled: boolean; balance: CreditBalanceType | null } | null> => null

  const showBuyCredits = (..._args: any[]) => {}

  const handleAiCreditError = async (..._args: any[]): Promise<boolean> => false

  const handleAiCreditErrorRaw = (..._args: any[]): boolean => false

  return {
    balance,
    packs,
    ledger,
    isLoadingBalance,
    isLoadingLedger,
    ledgerIsLastPage,
    creditsEnabled,
    available,
    isLowBalance,
    blockAiCredits,
    loadBalance,
    loadPacks,
    loadLedger,
    createTopupCheckout,
    verifyTopup,
    showBuyCredits,
    handleAiCreditError,
    handleAiCreditErrorRaw,
  }
})

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useCredits as any, import.meta.hot))
}
