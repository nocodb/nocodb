import type { BuildIntent } from '~/utils/buildIntentUtils'
import { BUILD_INTENT_KEY, parseBuildIntentFromSearch, parseStoredBuildIntent } from '~/utils/buildIntentUtils'

/**
 * Build intent — a "what do you want to build?" prompt handed over from the NocoAI
 * marketing landing page, which sends visitors to
 * `/signup?basePrompt=<text>&autoBuild=1`.
 *
 * Those params cannot be read off the route when they finally matter, because two
 * things drop them on the way in: `middleware/03.auth.global.ts` bounces an
 * anonymous visitor and preserves only a continue-path that is not a
 * root-with-query (`/?…` fails its `/^\/(?!\?)/` test), and `Signup.vue` then
 * navigates to the questionnaire ignoring `continueAfterSignIn` altogether. So the
 * intent is banked in localStorage at boot — before route middleware runs — and
 * replayed once the user is signed in and inside a workspace.
 *
 * Single-shot (consumed on replay, so a refresh never rebuilds), time-boxed (a
 * signup resumed days later never surprise-builds), and opt-in (only a hand-off
 * carrying `autoBuild` is captured, so plain `?basePrompt=` deep links keep their
 * prefill-and-wait behaviour).
 */

/**
 * The hand-off params, once they are on the route, are built exactly once.
 *
 * Two `CreateProjectDlg`s can be mounted at the same time (the workspace page and the
 * mini sidebar) and both read the query in the same flush, so the claim cannot live in
 * a component. Module scope rather than inside the shared composable: this must not be
 * reset when the last consumer unmounts.
 */
let isRouteHandoffClaimed = false

/** Returns false when another reader already took this hand-off. */
export function claimRouteBuildHandoff(): boolean {
  if (isRouteHandoffClaimed) return false

  isRouteHandoffClaimed = true
  return true
}

export function releaseRouteBuildHandoff() {
  isRouteHandoffClaimed = false
}

/**
 * Storage access is wrapped because `localStorage` is null or throws in some embedded
 * webviews and privacy modes; a lost build intent is never worth crashing boot over.
 */
function readStored(): string | null {
  try {
    return localStorage?.getItem(BUILD_INTENT_KEY) ?? null
  } catch {
    return null
  }
}

function writeStored(value: BuildIntent | null) {
  try {
    if (value) {
      localStorage?.setItem(BUILD_INTENT_KEY, JSON.stringify(value))
    } else {
      localStorage?.removeItem(BUILD_INTENT_KEY)
    }
  } catch {
    // storage unavailable — the funnel degrades to a manual build, which is fine
  }
}

export const useBuildIntent = createSharedComposable(() => {
  const intent = ref<BuildIntent | null>(parseStoredBuildIntent(readStored(), Date.now()))

  // Evict anything corrupt or expired that we just refused to load.
  if (!intent.value) writeStored(null)

  const hasBuildIntent = computed(() => !!intent.value)

  /**
   * Bank a hand-off carried on the URL. Returns whether an intent was captured.
   *
   * Deliberately does not touch the address bar: stripping it here loses the race
   * with the router, which re-serialises the query from its own resolved route right
   * after. URL hygiene lives in `plugins/buildIntent.client.ts`, which can wait for
   * the router to be ready.
   */
  function captureFromUrl(search: string): boolean {
    const captured = parseBuildIntentFromSearch(search, Date.now())
    if (!captured) return false

    intent.value = captured
    writeStored(captured)

    return true
  }

  /** Hand the intent over and forget it — single-shot by construction. */
  function consume(): BuildIntent | null {
    const pending = intent.value
    if (!pending) return null

    intent.value = null
    writeStored(null)

    return pending
  }

  function clear() {
    intent.value = null
    writeStored(null)
  }

  return {
    intent,
    hasBuildIntent,
    captureFromUrl,
    consume,
    clear,
  }
})
