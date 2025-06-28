// enable openreplay session recording in cloud edition and not in enterprise edition
import { defineNuxtPlugin } from '#app'

export default defineNuxtPlugin(() => {
  const { appInfo } = useGlobal()

  watch([() => appInfo.value?.isCloud, () => appInfo.value?.isOnPrem], ([isCloud, isOnPrem]) => {
    if (isCloud && !isOnPrem) {
      const script = document.createElement('script')
      script.src = 'https://cdn.nocodb.com/lib/or.min.js'
      script.async = true
      script.onload = () => {
        ;(window as any).OpenReplay.init({
          // TODO: make these part of appInfo
          projectKey: 'WX6JlrfCDKS1uuuzhbYm',
          ingestPoint: 'https://opr.nocodb.com/ingest',
        })
      }
      document.head.appendChild(script)
    }
  })
})
