import { useStorage } from '@vueuse/core'
import type { DriveStep, Driver } from 'driver.js'
import type { NcTour, NcTourStep, TourDeployment, TourPredicate } from '../tours'
import { resolveTourAnchor, resolveTourText, tourAnchorSelector, useTourEventBus } from '../tours'
import type { BetaFeatureId } from './useBetaFeatureToggle'

export type TourSource = 'auto' | 'route' | 'click' | 'event' | 'beacon' | 'help-menu' | 'feed' | 'debug' | 'manual'

export type TourStatus = 'completed' | 'dismissed'

export interface TourStateEntry {
  status: TourStatus
  /** ISO timestamp. */
  at: string
}

export type TourStateMap = Record<string, TourStateEntry>

export interface TourEligibility {
  eligible: boolean
  reason?: string
}

/** Key under `user.meta` holding per-tour seen state (cross-device). */
const USER_META_KEY = 'tours'

/** localStorage, not sessionStorage — the latter is per-tab and re-fires in each new tab. */
const AUTO_FIRED_KEY = 'nc-tours-auto-fired'

/**
 * Set when the onboarding questionnaire finishes. Needed because completing it
 * clears `is_new_user` on `/`, before any page evaluates triggers — without this
 * the onboarding tour would fire only where the questionnaire is disabled (dev
 * and test) and never in production.
 */
const ONBOARDING_HANDOFF_KEY = 'nc-tours-onboarding-handoff'

const COOLDOWN_DAYS = 7

/**
 * Zero because `waitForAnchor` below already waits, and it waits better — it
 * requires a settled rect, where driver only requires existence. Leaving driver's
 * own wait on is not merely redundant: it re-arms for every step it skips past, so
 * three missing anchors in a row cost 3× this before the next real step renders.
 */
const WAIT_FOR_ELEMENT_MS = 0

/** Budget for a local reveal (dropdown, drawer, panel) to appear and settle. */
const ANCHOR_WAIT_MS = 1200

/** Same, for a step that navigates first — a page load needs far longer. */
const ANCHOR_WAIT_NAVIGATING_MS = 8000

/** Only needs to cover the layout swap — driver.js polls for the anchor after. */
const GOTO_SETTLE_MS = 350

const DAY_MS = 24 * 60 * 60 * 1000

/** White halo drawn around the highlighted element. */
const STAGE_PADDING = 8

/**
 * Gap between the halo edge and the popover. driver.js positions the popover at
 * `stagePadding + popoverOffset` from the element, so this is the gap from the
 * halo, not from the element.
 *
 * Kept small on purpose: the arrow is anchored to the popover, not to the
 * element, so a large offset leaves it pointing at empty overlay. 8 leaves the
 * 5px arrow tip just short of the halo.
 */
const POPOVER_OFFSET = 8

/** Cooldown applies to these. `click` is excluded — the user asked for it. */
const PASSIVE_TRIGGERS = new Set(['auto', 'route', 'event'])

/**
 * The tour system: eligibility, triggers, running, persistence. See tours/README.md.
 *
 * driver.js is imported lazily in `start` so it costs nothing until a tour runs,
 * and so `useOnboardingFlow` (which only needs `markOnboardingHandoff`) doesn't
 * pull it into its chunk. Its stylesheet stays eager in `components/tour/Host.vue`
 * — loading it dynamically would append it after that component's own style block
 * and override the design-system overrides there.
 */
export const useTours = createSharedComposable(() => {
  const { $e } = useNuxtApp()

  const { appInfo, user } = useGlobal()

  const { allTours, getTourById } = useTourRegistry()

  const { updateUserMeta } = useUsers()

  const { allRoles } = useRoles()

  const { isFeatureEnabled } = useBetaFeatureToggle()

  const router = useRouter()

  const route = useRoute()

  const activeTour = ref<NcTour>()

  const activeSource = ref<TourSource>()

  /** Optimistic overlay on the persisted map. */
  const localState = ref<TourStateMap>({})

  /**
   * Keyed by user id: localStorage is browser-global, so on a shared browser a bare
   * value lets the first user to finish onboarding suppress the tour for everyone
   * after them. Seen-state proper lives in `user.meta` and is already per-user.
   */
  const autoFiredByUser = useStorage<Record<string, string[]>>(AUTO_FIRED_KEY, {})

  const onboardingHandoffByUser = useStorage<Record<string, boolean>>(ONBOARDING_HANDOFF_KEY, {})

  /** Signed-out is its own bucket rather than a shared one. */
  const userKey = computed(() => user.value?.id ?? 'anonymous')

  const autoFired = computed<string[]>(() => autoFiredByUser.value[userKey.value] ?? [])

  function setAutoFired(ids: string[]) {
    autoFiredByUser.value = { ...autoFiredByUser.value, [userKey.value]: ids }
  }

  /** Distinguishes an engine-initiated teardown from the user hitting Esc. */
  let isInternalStop = false

  let driverObj: Driver | undefined

  /** Steps being driven, after `when` filtering. */
  let activeSteps: NcTourStep[] = []

  /** Set for the duration of a `goNext` transition. See the guard there. */
  let isAdvancing = false

  /** Set while the tour itself is navigating. See `applyGoto`. */
  let isSelfNavigating = false

  /** Triggered but not yet opened. */
  const pendingTriggers = new Set<string>()

  /** driver.js's footer node, so Host.vue can teleport NcButtons into it. */
  const popoverFooter = ref<HTMLElement>()

  const popoverNav = ref<{ hasPrev: boolean; isLast: boolean; canAdvance: boolean; advanceOnClick: boolean }>({
    hasPrev: false,
    isLast: false,
    canAdvance: true,
    advanceOnClick: false,
  })

  const isActive = computed(() => !!activeTour.value)

  const state = computed<TourStateMap>(() => ({
    ...((parseProp(user.value?.meta)?.[USER_META_KEY] as TourStateMap) ?? {}),
    ...localState.value,
  }))

  const deployment = computed<TourDeployment>(() => {
    if (!isEeUI) return 'ce'
    if (!appInfo.value?.isOnPrem) return 'cloud'

    return appInfo.value?.ee ? 'onprem-licensed' : 'onprem-unlicensed'
  })

  /** For the cooldown. */
  const lastInteractionAt = computed<Date | undefined>(() => {
    const stamps = Object.values(state.value)
      .map((e) => e.at)
      .filter(Boolean)
      .sort()

    const latest = stamps[stamps.length - 1]

    return latest ? new Date(latest) : undefined
  })

  function isSeen(tourId: string): boolean {
    return !!state.value[tourId]?.status
  }

  /** Never fails open: an errored gate must not interrupt, or advertise a blocked feature. */
  function safePredicate(fn: TourPredicate, tour: NcTour, label: string): boolean {
    try {
      // Predicates run outside setup, so they get the route handed to them rather
      // than calling `useRoute()` themselves.
      return fn({ route })
    } catch (e) {
      console.error(`[tours] ${label} threw for "${tour.id}"`, e)
      return false
    }
  }

  /**
   * Whether a tour is relevant to this viewer. Holds no gating rules of its own —
   * it only composes gates the app already enforces, so nothing can drift.
   */
  function explain(tour: NcTour): TourEligibility {
    if (appInfo.value?.disableTours) {
      return { eligible: false, reason: 'tours disabled (appInfo.disableTours)' }
    }

    const audience = tour.audience

    if (!audience) return { eligible: true }

    if (audience.deployment && !audience.deployment.includes(deployment.value)) {
      return {
        eligible: false,
        reason: `deployment is "${deployment.value}", tour wants ${audience.deployment.join(' | ')}`,
      }
    }

    if (audience.roles?.length && !audience.roles.some((role) => (allRoles.value ?? {})[role])) {
      return { eligible: false, reason: `no matching role (wants ${audience.roles.join(' | ')})` }
    }

    if (audience.betaFlag && !isFeatureEnabled(audience.betaFlag as BetaFeatureId)) {
      return { eligible: false, reason: `beta flag "${audience.betaFlag}" is off` }
    }

    if (audience.route && !audience.route.test(route.path)) {
      return { eligible: false, reason: `route "${route.path}" does not match ${audience.route}` }
    }

    if (audience.when && !safePredicate(audience.when, tour, 'audience.when')) {
      return { eligible: false, reason: 'audience.when() returned false or threw' }
    }

    return { eligible: true }
  }

  function isEligible(tour: NcTour): boolean {
    return explain(tour).eligible
  }

  const availableTours = computed<NcTour[]>(() => allTours.filter((tour) => isEligible(tour)))

  const activeBeacons = computed(() =>
    allTours
      .filter((tour) => tour.trigger.type === 'beacon' && !isSeen(tour.id) && isEligible(tour))
      .map((tour) => ({ tour, anchor: tour.trigger.type === 'beacon' ? tour.trigger.anchor : '' })),
  )

  async function setStatus(tourId: string, status: TourStatus) {
    localState.value = { ...localState.value, [tourId]: { status, at: new Date().toISOString() } }

    try {
      // The backend replaces `meta` wholesale — must go through the merging helper.
      await updateUserMeta({ [USER_META_KEY]: { ...state.value } })
    } catch (e) {
      console.error('[tours] failed to persist tour state', e)
    }
  }

  /** Also clears the auto-fired record, so a reset tour can trigger again. */
  async function reset(tourId?: string) {
    const next = { ...state.value }

    if (tourId) delete next[tourId]

    localState.value = tourId ? next : {}
    setAutoFired(tourId ? autoFired.value.filter((id) => id !== tourId) : [])

    try {
      await updateUserMeta({ [USER_META_KEY]: tourId ? next : {} })
    } catch (e) {
      console.error('[tours] failed to reset tour state', e)
    }
  }

  /** Called by useOnboardingFlow once the questionnaire is done or skipped. */
  function markOnboardingHandoff() {
    onboardingHandoffByUser.value = { ...onboardingHandoffByUser.value, [userKey.value]: true }
  }

  function hasOnboardingHandoff(): boolean {
    return !!onboardingHandoffByUser.value[userKey.value]
  }

  function emit(event: string, data: Record<string, unknown> = {}) {
    if (!activeTour.value) return

    $e(`c:tour:${event}`, {
      tourId: activeTour.value.id,
      kind: activeTour.value.kind,
      source: activeSource.value,
      ...data,
    })
  }

  function teardown() {
    isInternalStop = true

    try {
      driverObj?.destroy()
    } finally {
      isInternalStop = false
      driverObj = undefined
      activeSteps = []
      popoverFooter.value = undefined
      activeTour.value = undefined
      activeSource.value = undefined
    }
  }

  function stop() {
    if (driverObj) teardown()
  }

  async function finish(status: TourStatus, stepIndex?: number) {
    const tour = activeTour.value
    if (!tour) return

    emit(status === 'completed' ? 'complete' : 'dismiss', stepIndex === undefined ? {} : { stepIndex })

    teardown()

    await setStatus(tour.id, status)
  }

  /**
   * Wait for the next target to exist *and* settle. driver.js measures the anchor
   * once and never again, so it needs two equal measurements: a canvas node mounts
   * narrow and widens a frame later, which leaves the popover over the element.
   *
   * The timeout is paid in full whenever the anchor never appears, so it is per
   * transition rather than per tour: only a step that navigates needs seconds, and
   * charging every step that budget makes a click look like it did nothing.
   */
  async function waitForAnchor(anchor: string, timeoutMs = ANCHOR_WAIT_MS) {
    const deadline = Date.now() + timeoutMs

    let previous: string | undefined

    while (Date.now() < deadline) {
      const rect = resolveTourAnchor(anchor)?.getBoundingClientRect()

      if (rect && rect.width > 0 && rect.height > 0) {
        const current = `${Math.round(rect.width)}x${Math.round(rect.height)}@${Math.round(rect.left)},${Math.round(rect.top)}`

        if (current === previous) return true

        previous = current
      } else {
        previous = undefined
      }

      await new Promise((resolve) => setTimeout(resolve, 120))
    }

    return false
  }

  async function applyGoto(step?: NcTourStep) {
    if (!step?.goto) return

    // The route watcher below treats an unrecognised navigation as the user
    // walking away and ends the tour. This flag marks the tour's own navigation so
    // it doesn't dismiss itself — the watcher can only recognise a *string* `goto`
    // by path, and a `goto` function is the only way to reach a dynamic route.
    isSelfNavigating = true

    // A redundant navigation rejects in vue-router and is harmless; so does one
    // the app's own middleware redirects or aborts. Anything else is real and must
    // not be swallowed. This covers both `goto` forms — `router.push` rejects the
    // same way, and `goNext` calls this fire-and-forget, so an escaping rejection
    // is unhandled and leaves the tour mid-transition.
    try {
      if (typeof step.goto === 'string') {
        if (route.path !== step.goto) await router.push(step.goto)
      } else {
        await step.goto({ route, router })
      }
    } catch (e) {
      const message = (e as Error)?.message ?? ''

      if (!/redundant|duplicated|Avoided/i.test(message)) {
        console.error('[tours] goto() failed', e)
      }
    }

    await new Promise((resolve) => setTimeout(resolve, GOTO_SETTLE_MS))

    isSelfNavigating = false
  }

  function toDriveStep(tour: NcTour, step: NcTourStep, navigates: boolean): DriveStep {
    return {
      ...(step.anchor ? { element: tourAnchorSelector(step.anchor) } : {}),
      // Fatal for a navigating tour: driver.js decides `hasNextStep()` by skipping
      // steps whose element is missing *now*, so it declares itself finished early.
      skipMissingElement: !navigates,
      waitForElement: WAIT_FOR_ELEMENT_MS,
      ...(step.allowInteraction === false ? { disableActiveInteraction: true } : {}),
      popover: {
        title: resolveTourText(step.title),
        description: resolveTourText(step.description),
        ...(step.side ? { side: step.side } : {}),
        ...(step.align ? { align: step.align } : {}),
        popoverClass: `nc-tour-popover nc-tour-${tour.kind}`,
        // Setting these stops driver advancing on its own; `advanceOnClick` is
        // handled in `init` so every transition goes through `goNext`.
        onNextClick: goNext,
        onPrevClick: goPrev,
        onCloseClick: closeTour,
      },
    }
  }

  async function goNext() {
    if (!driverObj) return

    // A transition can take seconds while `navPoll` re-checks every 400ms. Without
    // this, a second call enters on the same index and both reach `moveNext()`,
    // consuming two steps for one advance.
    if (isAdvancing) return

    isAdvancing = true

    try {
      const index = driverObj.getActiveIndex() ?? 0

      emit('step', { stepIndex: index, action: 'next' })

      try {
        await activeSteps[index]?.onNext?.()
      } catch (e) {
        console.error(`[tours] step ${index} of "${activeTour.value?.id}" failed to advance`, e)
        await finish('dismissed', index)
        return
      }

      if (!driverObj) return

      if (driverObj.isLastStep()) {
        await finish('completed', index)
        return
      }

      const next = activeSteps[index + 1]

      await applyGoto(next)

      if (next?.anchor) await waitForAnchor(next.anchor, next.goto ? ANCHOR_WAIT_NAVIGATING_MS : ANCHOR_WAIT_MS)

      driverObj?.moveNext()
    } finally {
      isAdvancing = false
    }
  }

  async function goPrev() {
    if (!driverObj) return

    const index = driverObj.getActiveIndex() ?? 0

    emit('step', { stepIndex: index, action: 'prev' })

    await applyGoto(activeSteps[index - 1]).catch(() => {})

    driverObj?.movePrevious()
  }

  function closeTour() {
    finish('dismissed', driverObj?.getActiveIndex())
  }

  /** Silent skips look like bugs, so name what was dropped. */
  function warnMissingAnchors(tour: NcTour, steps: NcTourStep[], navigates: boolean) {
    // A navigating tour legitimately has anchors that don't exist yet.
    if (navigates) return

    const missing = steps.filter((s) => s.anchor && !resolveTourAnchor(s.anchor)).map((s) => s.anchor)

    if (!missing.length) return

    console.warn(
      `[tours] "${tour.id}": ${missing.length}/${steps.length} anchors are not on this page and will be skipped —`,
      missing,
      '\nEither add `goto` to the step, or check the element renders here and that any ee/ override carries data-tour.',
    )
  }

  async function start(tourOrId: NcTour | string, source: TourSource = 'manual') {
    const tour = typeof tourOrId === 'string' ? getTourById(tourOrId) : tourOrId

    if (!tour) {
      console.error(`[tours] unknown tour "${String(tourOrId)}"`)
      return false
    }

    const eligibility = explain(tour)

    // 'debug' previews a tour you don't personally qualify for.
    if (!eligibility.eligible && source !== 'debug') {
      console.warn(`[tours] "${tour.id}" not eligible: ${eligibility.reason}`)
      return false
    }

    // Filtered once so the step list can't change length mid-run.
    const steps = tour.steps.filter((step) => !step.when || safePredicate(step.when, tour, 'step.when'))

    const navigates = steps.some((step) => !!step.goto)

    if (!steps.length) {
      console.warn(`[tours] "${tour.id}" has no runnable steps`)
      return false
    }

    stop()

    activeTour.value = tour
    activeSource.value = source
    activeSteps = steps

    await applyGoto(steps[0])

    warnMissingAnchors(tour, steps, navigates)

    const { driver } = await import('driver.js')

    driverObj = driver({
      showProgress: steps.length > 1,
      progressText: '{{current}} of {{total}}',
      // Any outside click counts as a backdrop click and destroys the tour — which
      // kills it the moment the user touches a dialog the step just opened.
      allowClose: false,
      // Escape while typing in a dialog should be the dialog's, not ours.
      allowKeyboardControl: false,
      smoothScroll: true,
      stagePadding: STAGE_PADDING,
      stageRadius: 8,
      overlayOpacity: 0.55,
      popoverOffset: POPOVER_OFFSET,
      // Suppresses ALL of driver's own buttons; Host.vue teleports ours in. Do NOT
      // "simplify" to `[]` — driver intersects this list with ['next','previous',…],
      // and an empty array short-circuits the filter, rendering its buttons too.
      showButtons: ['close'],
      steps: steps.map((step) => toDriveStep(tour, step, navigates)),
      onPopoverRender: (popover) => {
        popoverFooter.value = popover.footerButtons
        refreshNav()

        // driver focuses the popover on every render, stealing it from a dialog the
        // step just opened — the field looks focused but keystrokes go nowhere.
        const previous = document.activeElement as HTMLElement | null

        setTimeout(() => {
          const stolen = popover.wrapper.contains(document.activeElement)
          const stillThere = previous && previous.isConnected && !popover.wrapper.contains(previous)

          if (stolen && stillThere) previous.focus()
        })
      },
      onDestroyed: () => {
        // Also fires for our own teardown; only backdrop/Esc count as a dismissal.
        if (!isInternalStop) finish('dismissed', driverObj?.getActiveIndex())
      },
    })

    emit('start', { stepCount: steps.length })

    // `goNext` does this for steps 2..n; step 1 would otherwise be measured mid-layout.
    if (steps[0]?.anchor) {
      await waitForAnchor(steps[0].anchor, steps[0].goto ? ANCHOR_WAIT_NAVIGATING_MS : ANCHOR_WAIT_MS)
    }

    driverObj.drive()

    return true
  }

  /** The product legitimately disables these — Publish stays off until every node has a fresh test. */
  function isAnchorActionable(step?: NcTourStep): boolean {
    if (!step?.anchor) return true

    const el = resolveTourAnchor(step.anchor)

    // Absent is the strongest form of unclickable. driver renders the step anyway
    // when the tour navigates (`skipMissingElement: false`), so without this the
    // user gets a step describing something that isn't on screen and no Next.
    if (!el) return false

    const button = el.closest('button') ?? el.querySelector('button') ?? el

    return !(button as HTMLButtonElement).disabled && button.getAttribute('aria-disabled') !== 'true'
  }

  /**
   * Action-driven tours reveal their own UI, so Next stays disabled until the
   * *next* step has something to point at — "do the thing, then continue".
   */
  function refreshNav() {
    const index = driverObj?.getActiveIndex() ?? 0
    const current = activeSteps[index]
    const next = activeSteps[index + 1]

    popoverNav.value = {
      hasPrev: !!driverObj?.hasPreviousStep(),
      isLast: !driverObj?.hasNextStep(),
      // `hasNextStep()` is load-bearing: it resolves through driver's skip list, so
      // a next anchor that never appears (EE-only element in CE, wrong page) skips
      // ahead instead of leaving Next disabled forever.
      canAdvance: !next || !next.anchor || !!next.goto || !!resolveTourAnchor(next.anchor) || !!driverObj?.hasNextStep(),
      // A Next button would be a second, contradictory way forward — unless the
      // target is disabled, where hiding it leaves no way forward at all. `navPoll`
      // re-runs this, so Next disappears once the control becomes usable.
      advanceOnClick: (!!current?.advanceOnClick && isAnchorActionable(current)) || !!current?.advanceWhen,
    }
  }

  /** driver.js does not observe layout — reposition after the page moves. */
  function refresh() {
    driverObj?.refresh()
  }

  /** The interruption budget — distinct from eligibility, which asks about relevance. */
  function canTrigger(tour: NcTour): boolean {
    if (appInfo.value?.disableTours) return false
    if (isActive.value) return false
    if (isSeen(tour.id)) return false
    if (autoFired.value.includes(tour.id)) return false

    // Guards two triggers racing in one page load.
    if (pendingTriggers.has(tour.id)) return false

    if (PASSIVE_TRIGGERS.has(tour.trigger.type)) {
      const last = lastInteractionAt.value

      if (last && Date.now() - last.getTime() < COOLDOWN_DAYS * DAY_MS) return false
    }

    if (!triggerWhenHolds(tour)) return false

    return isEligible(tour)
  }

  /**
   * Split out because it is evaluated twice — once to schedule the trigger, once
   * when its delay expires. See `fire`.
   */
  function triggerWhenHolds(tour: NcTour): boolean {
    const when = 'when' in tour.trigger ? tour.trigger.when : undefined

    return !when || safePredicate(when, tour, 'trigger.when')
  }

  function fire(tour: NcTour, source: TourSource) {
    const delay = 'delay' in tour.trigger ? tour.trigger.delay ?? 0 : 0

    pendingTriggers.add(tour.id)

    setTimeout(() => {
      // Re-checked after the delay, not only when scheduling: the user can navigate
      // in between, so a route gate that held at schedule time may not hold now.
      // This is what lets a route condition live on the trigger rather than in
      // `audience`, which would also hide the tour from the Help menu.
      if (isActive.value || !triggerWhenHolds(tour)) {
        pendingTriggers.delete(tour.id)
        return
      }

      start(tour, source)
        .then((started) => {
          // Persist only once it really opened — `autoFired` is durable, so
          // marking on attempt would suppress the tour permanently.
          if (started && !autoFired.value.includes(tour.id)) {
            setAutoFired([...autoFired.value, tour.id])
          }
        })
        .catch((e) => console.error(`[tours] failed to start "${tour.id}"`, e))
        .finally(() => pendingTriggers.delete(tour.id))
    }, delay)
  }

  function findTrigger(predicate: (tour: NcTour) => boolean): NcTour | undefined {
    return allTours.find((tour) => predicate(tour) && canTrigger(tour))
  }

  function matchesRoute(path: string | RegExp, current: string): boolean {
    return typeof path === 'string' ? current.startsWith(path) : path.test(current)
  }

  /** Called once by the tour host at app root; listeners live for the app's lifetime. */
  function init() {
    // A tour missing from the Help menu is otherwise undebuggable: `explain()`
    // reasons are only logged when a tour is started, never when one is filtered
    // out of `availableTours`. Run `__ncTours()` in the console to see every
    // tour with its verdict.
    if (import.meta.dev) {
      console.log(
        `[tours] registry loaded ${allTours.length} tour(s):`,
        allTours.map((t) => t.id),
      )

      // Log the verdict for every tour whenever the eligible set changes, so a
      // tour vanishing from the Help menu says why instead of just disappearing.
      watch(
        availableTours,
        (listed) => {
          console.log(
            `[tours] eligible here (${route.path}):`,
            listed.map((t) => t.id),
          )

          for (const tour of allTours) {
            const verdict = explain(tour)

            if (!verdict.eligible) console.log(`[tours]   ✕ ${tour.id} — ${verdict.reason}`)
          }
        },
        { immediate: true },
      )
      // Start any tour by id, bypassing eligibility — for testing without the
      // beta-flagged Help menu.
      ;(window as any).__ncStartTour = (id: string) => start(id, 'debug')
      // Jump straight to a step, for reproducing one without walking the tour.
      ;(window as any).__ncTourGoTo = (index: number) => driverObj?.moveTo(index)
      ;(window as any).__ncTours = () =>
        console.table(
          allTours.map((t) => ({
            id: t.id,
            eligible: explain(t).eligible,
            reason: explain(t).reason ?? '',
            seen: isSeen(t.id),
            trigger: t.trigger.type,
          })),
        )
    }

    if (appInfo.value?.disableTours) return

    const auto = findTrigger((t) => t.trigger.type === 'auto')
    if (auto) fire(auto, 'auto')

    const routeTours = allTours.filter((tour) => tour.trigger.type === 'route')

    if (routeTours.length) {
      watch(
        () => route.path,
        (path) => {
          const tour = routeTours.find((t) => t.trigger.type === 'route' && matchesRoute(t.trigger.path, path) && canTrigger(t))

          if (tour) fire(tour, 'route')
        },
        { immediate: true },
      )
    }

    // Ours, not driver's: driver calls `moveNext()` the instant the element is
    // clicked, rendering against an anchor with no layout yet. Going through
    // `goNext` makes every transition wait first.
    useEventListener(
      document,
      'click',
      (e) => {
        if (!isActive.value) return

        const step = activeSteps[driverObj?.getActiveIndex() ?? -1]
        if (!step?.advanceOnClick || !step.anchor) return

        const target = e.target as Element | null
        const anchor = resolveTourAnchor(step.anchor)

        if (!target || !anchor || !anchor.contains(target)) return

        goNext()
      },
      // Capture, so we still see the click if the handler removes the element.
      true,
    )

    // Delegated, so it covers elements that mount later. Only registered when a
    // tour actually wants it: this fires on every click in the app, and
    // `findTrigger` evaluates eligibility for each tour — not something to pay
    // for on every click of every session when no tour uses the trigger.
    const clickTours = allTours.filter((tour) => tour.trigger.type === 'click')

    if (clickTours.length) {
      useEventListener(document, 'click', (e) => {
        const target = e.target as Element | null
        if (!target?.closest) return

        const tour = clickTours.find(
          (t) => t.trigger.type === 'click' && !!target.closest(tourAnchorSelector(t.trigger.on)) && canTrigger(t),
        )

        if (tour) fire(tour, 'click')
      })
    }

    const eventTours = allTours.filter((tour) => tour.trigger.type === 'event')

    if (eventTours.length) {
      useTourEventBus().on((name) => {
        const tour = eventTours.find((t) => t.trigger.type === 'event' && t.trigger.name === name && canTrigger(t))

        if (tour) fire(tour, 'event')
      })
    }

    // appInfo and user arrive async — an `auto` tour gated on either would
    // otherwise be evaluated against empty state.
    watch(
      () => !!user.value?.id && !!appInfo.value,
      (ready, wasReady) => {
        if (!ready || wasReady) return

        const tour = findTrigger((t) => t.trigger.type === 'auto')

        if (tour) fire(tour, 'auto')
      },
    )
  }

  // The next step's target usually appears in response to something the user
  // does, so poll rather than reacting only to step changes.
  //
  // Started paused and driven by `isActive`: this composable is created at app
  // start, so an always-on timer would wake the page 2.5x/second for every user
  // for the whole session, tour or no tour.
  const navPoll = useIntervalFn(
    () => {
      refreshNav()

      const tour = activeTour.value
      const step = activeSteps[driverObj?.getActiveIndex() ?? -1]

      if (tour && step?.advanceWhen && safePredicate(step.advanceWhen, tour, 'step.advanceWhen')) {
        goNext()
      }
    },
    400,
    { immediate: false },
  )

  watch(isActive, (active) => (active ? navPoll.resume() : navPoll.pause()), { immediate: true })

  // Navigating somewhere the tour didn't declare abandons it, rather than
  // highlighting whatever now sits at that selector.
  watch(
    () => route.path,
    (path) => {
      if (!isActive.value || isSelfNavigating) return

      // Still inside the tour's own scope — e.g. creating a workflow moves the
      // user from the list into the editor, which is the tour progressing, not
      // the user walking away.
      const declaredGoto = activeSteps.some((s) => typeof s.goto === 'string' && path.startsWith(s.goto))
      const inScope = activeTour.value?.audience?.route?.test(path) ?? false

      if (!declaredGoto && !inScope) {
        finish('dismissed', driverObj?.getActiveIndex())
      }
    },
  )

  return {
    activeTour,
    isActive,
    availableTours,
    activeBeacons,
    popoverFooter,
    popoverNav,
    goNext,
    goPrev,
    closeTour,
    start,
    stop,
    refresh,
    init,
    isSeen,
    reset,
    markOnboardingHandoff,
    hasOnboardingHandoff,
    explain,
  }
})
