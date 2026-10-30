// Chatwoot SDK method that the @productdevbook/chatwoot typings omit
interface ChatwootColorScheme {
  setColorScheme?: (mode: 'light' | 'dark') => void
}

export const syncChatwootColorScheme = (isDark: boolean) => {
  if (typeof window === 'undefined') return
  const chatwoot = window.$chatwoot as (typeof window.$chatwoot & ChatwootColorScheme) | undefined
  chatwoot?.setColorScheme?.(isDark ? 'dark' : 'light')
}
