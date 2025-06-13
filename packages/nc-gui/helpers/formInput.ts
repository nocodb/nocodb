export const deepReferenceHelper = (formState: Ref, path: string): any => {
  return path.split('.').reduce((acc, key) => (acc ? acc[key] : null), formState.value)
}

export const setFormStateHelper = (formState: Ref, path: string, value: any) => {
  // update nested prop in formState
  const keys = path.split('.')
  const lastKey = keys.pop()

  if (!lastKey) return

  const target = keys.reduce((acc, key) => {
    if (!acc[key]) {
      acc[key] = {}
    }
    return acc[key]
  }, formState.value)
  target[lastKey] = value
}
