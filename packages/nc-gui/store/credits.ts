import { acceptHMRUpdate, defineStore } from 'pinia'
import type { CreditBalanceType, CreditLedgerRowType, CreditPackType, CreditUsageDailyType } from 'nocodb-sdk'

export const useCredits = defineStore('creditsStore', () => {
  const balance = ref<CreditBalanceType | null>(null)

  const packs = ref<CreditPackType[]>([])

  const ledger = ref<CreditLedgerRowType[]>([])

  const usageDaily = ref<CreditUsageDailyType[]>([])

  const isLoadingBalance = ref(false)

  const isLoadingLedger = ref(false)

  const ledgerIsLastPage = ref(true)

  const creditsEnabled = computed(() => false)

  const available = computed(() => 0)

  const isLowBalance = computed(() => false)

  const blockAiCredits = computed(() => false)

  const canManageCredits = computed(() => false)

  const canPurchaseCredits = computed(() => false)

  const orgBillingId = ref<string | null>(null)

  const setOrgBilling = (_orgId: string | null): number => 0

  const clearOrgBilling = (_epoch: number) => {}

  const loadBalance = async () => {}

  const loadPacks = async () => {}

  const loadLedger = async (..._args: any[]) => {}

  const loadUsageDaily = async (..._args: any[]) => {}

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
    usageDaily,
    isLoadingBalance,
    isLoadingLedger,
    ledgerIsLastPage,
    creditsEnabled,
    available,
    isLowBalance,
    blockAiCredits,
    canManageCredits,
    canPurchaseCredits,
    orgBillingId,
    setOrgBilling,
    clearOrgBilling,
    loadBalance,
    loadPacks,
    loadLedger,
    loadUsageDaily,
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
