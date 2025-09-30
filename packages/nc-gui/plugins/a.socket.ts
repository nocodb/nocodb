export default defineNuxtPlugin(async (nuxtApp) => {
  if (!isEeUI) {
    const ncSocket = {
      id: () => null,
      onMessage: (..._args: any[]) => null,
      offMessage: (..._args: any[]) => null,
    }
    nuxtApp.provide('ncSocket', ncSocket)
  }
})
