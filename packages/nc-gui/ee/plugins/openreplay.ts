// enable openreplay session recording in cloud edition and not in enterprise edition
import { defineNuxtPlugin } from '#app'
import type { User } from '~/lib/types'

const setMetadatas = ({
  user,
  params,
  tracker,
}: {
  user: User | null
  params: Record<string, any>
  tracker: { setMetadata: (key: string, value: any) => void }
}) => {
  tracker.setMetadata('email', user?.email)
  tracker.setMetadata('user_id', user?.id)

  if (params?.base_id) {
    tracker.setMetadata('base_id', params.base_id)
  }
  if (params?.typeOrId) {
    tracker.setMetadata('workspace_id', params.typeOrId)
  }
  if (params?.viewId) {
    tracker.setMetadata('table_id', params.viewId)
  }
  if (params?.viewTitle) {
    tracker.setMetadata('view_id', params.viewTitle)
  }

  tracker.setMetadata('domain', window.location.hostname)
}

export default defineNuxtPlugin(() => {
  let tracker: any
  const { appInfo, user } = useGlobal()

  const router = useRouter()

  const route = router.currentRoute

  watch(
    [() => appInfo.value?.isCloud, () => appInfo.value?.isOnPrem, () => user.value?.email, () => appInfo.value?.openReplayKey],
    ([isCloud, isOnPrem, email, openReplayKey]) => {
      // skip if OpenReplay key is not present
      if (!openReplayKey) {
        return
      }

      // skip if on-prem
      if (isOnPrem) {
        return
      }

      // skip if not cloud
      if (!isCloud) {
        return
      }

      // skip if user email is not available(not logged in)
      if (!email) {
        return
      }

      // if nocodb email skip
      if (email.endsWith('@nocodb.com')) {
        return
      }

      try {
        if (!tracker) {
          const script = document.createElement('script')
          script.src = 'https://cdn.nocodb.com/lib/or.min.js'
          script.async = true
          script.onload = () => {
            tracker = new (window as any).OpenReplay({
              projectKey: openReplayKey,
              ingestPoint: 'https://opr.nocodb.com/ingest',
              resourceBaseHref: 'https://cdn.nocodb.com',
              inlineCss: 3,
              canvas: {
                disableCanvas: true,
              },
            })

            tracker.start()

            if ((window as any).ncClientId) {
              tracker.setUserID((window as any).ncClientId)
            }

            setMetadatas({
              user: user.value,
              params: route.value?.params,
              tracker,
            })
            ;(window as any).orTracker = tracker
          }

          document.head.appendChild(script)
        } else if (tracker) {
          setMetadatas({
            user: user.value,
            params: route.value?.params,
            tracker,
          })
        }
      } catch (_e) {
        console.log('OR Init failed', _e.message)
      }
    },
    {
      immediate: true,
    },
  )

  router.afterEach((to, from) => {
    if (!tracker) {
      return
    }

    if (to.path === from.path && (to.query && to.query.type) === (from.query && from.query.type)) return

    try {
      setMetadatas({
        user: user.value,
        params: route.value?.params,
        tracker,
      })
    } catch (_e) {
      // ignore errors
    }
  })
})
