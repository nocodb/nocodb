import { BUILD_SCOPE_PARAM } from '~/utils/buildIntentUtils'

/**
 * Landing-page build hand-off: capture at boot, replay once inside a workspace.
 *
 * Capturing here rather than in a route guard is the whole point — plugins run during
 * app init, *before* route middleware, so the prompt is already banked by the time
 * `03.auth.global.ts` bounces an anonymous visitor to /signin and drops the query.
 * Replaying it as route query afterwards means the existing Build-with-AI prefill in
 * `CreateProjectDlg` opens the overlay with no new entry point to maintain.
 *
 * See `composables/useBuildIntent.ts` for why the URL cannot be trusted to survive.
 */
export default defineNuxtPlugin(function (nuxtApp) {
  const { captureFromUrl, intent, consume } = useBuildIntent()

  captureFromUrl(window.location.search)

  // Global state is only guaranteed inside this hook (same reason plugins/redirect.ts
  // defers its token watcher).
  nuxtApp.hooks.hook('app:created', () => {
    const router = useRouter()

    const route = router.currentRoute

    const { signedIn } = useGlobal()

    /**
     * Take the hand-off params out of the address bar on the auth pages, so a visitor
     * does not stare at their own prompt in the URL while signing up. Done through the
     * router (not history.replaceState) because the router re-serialises the query
     * from its resolved route and would otherwise put them straight back.
     *
     * Skipped once we are on a workspace/base route: there the params are the prefill's
     * input, and `CreateProjectDlg` clears them itself when the dialog closes.
     */
    router.isReady().then(() => {
      if (route.value.params.typeOrId) return
      if (!route.value.query.basePrompt && !route.value.query.autoBuild) return

      const query = { ...route.value.query }
      delete query.basePrompt
      delete query.autoBuild
      delete query[BUILD_SCOPE_PARAM]

      router.replace({ path: route.value.path, query, hash: route.value.hash })
    })

    watch(
      [signedIn, () => route.value.fullPath],
      () => {
        if (!signedIn.value || !intent.value) return

        // Wait for a workspace/base route: that is where the dashboard (and with it the
        // CreateProjectDlg that reads these params) is mounted. On `/` we are still
        // resolving the workspace, or showing the new-user questionnaire.
        if (!route.value.params.typeOrId) return

        // The route already carries the hand-off — an already-signed-in visitor landed
        // straight on a workspace URL, so the prefill is reading it from there. Retire
        // the stash rather than leaving it to fire again on some later navigation.
        if (route.value.query.basePrompt) {
          consume()
          return
        }

        const pending = consume()
        if (!pending) return

        router.replace({
          query: {
            ...route.value.query,
            basePrompt: pending.prompt,
            ...(pending.autoBuild ? { autoBuild: '1' } : {}),
            // 'app' is the default on the reading side, so only a narrow scope
            // needs to appear in the URL.
            ...(pending.scope !== 'app' ? { [BUILD_SCOPE_PARAM]: pending.scope } : {}),
          },
        })
      },
      { immediate: true },
    )
  })
})
