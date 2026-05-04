export const useOnPremLicense = createSharedComposable(() => {
  const isSelfServeLicensePurchaseEnabled = ref(true)

  return {
    isSelfServeLicensePurchaseEnabled,
  }
})
