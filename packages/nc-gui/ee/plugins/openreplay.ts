// enable openreplay session recording in cloud edition and not in enterprise edition
import { defineNuxtPlugin } from '#app'

export default defineNuxtPlugin(() => {
  let tracker: any
  const { appInfo, user } = useGlobal()

  watch([() => appInfo.value?.isCloud, () => appInfo.value?.isOnPrem], ([isCloud, isOnPrem]) => {
    if (isCloud && !isOnPrem) {
      const script = document.createElement('script')
      script.src = 'https://cdn.nocodb.com/lib/or.min.js'
      script.async = true
      script.onload = () => {
        tracker = new (window as any).OpenReplay({
          // TODO: make these part of appInfo
          projectKey: 'WX6JlrfCDKS1uuuzhbYm',
          ingestPoint: 'https://opr.nocodb.com/ingest',
          resourceBaseHref: 'https://cdn.nocodb.com',
          inlineCss: 3,
        })

        tracker.start()

        // if ((window as any).ncClientId) {
        //   tracker.setUserID((window as any).ncClientId)
        // }
      }
      document.head.appendChild(script)
    }
  })

  watch(
    () => user.value?.email,
    (email) => {
      if (!tracker) return
      tracker?.setUserID(email || (window as any).ncClientId)
    },
  )
})
