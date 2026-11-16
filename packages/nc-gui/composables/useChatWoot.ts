import { useChatWoot as useChatWootSdk } from '@productdevbook/chatwoot/vue'

/**
 * Re-exported so that `useChatWoot` stays auto-imported. It used to come from the
 * `@productdevbook/chatwoot` nuxt module, which is no longer registered because its plugin injects the
 * chatwoot SDK on app boot - see the note in `nuxt.config.ts` and `useProvideChatwoot`.
 */
export const useChatWoot = useChatWootSdk
