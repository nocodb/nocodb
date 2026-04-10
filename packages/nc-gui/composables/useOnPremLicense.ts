export const useOnPremLicense = createSharedComposable(() => {
  const isSelfServeLicensePurchaseEnabled = ref(false)

  return {
    isSelfServeLicensePurchaseEnabled,
  }
})
