import { defineTour } from '../types'
import { getI18n } from '~/plugins/a.i18n'

/**
 * Reference onboarding tour — walks a new user around the workspace shell.
 *
 * This file doubles as the worked example for authoring tours, so it is
 * commented more heavily than a real tour needs to be.
 *
 * Anchors are `data-tour` values, catalogued in `tours/anchors.catalog.md`. If the
 * element you want isn't listed there, add `data-tour="..."` to it in the template
 * — the `NcTourAnchorId` union is generated from those attributes by
 * `modules/tour-anchors.ts`, so it picks the new id up on the next build. Never
 * reach for a CSS selector.
 */

/** Deferred: this file is imported before the i18n plugin installs, and never runs in setup. */
const t = (key: string) => getI18n().global.t(key)

export default defineTour({
  // Versioned: bumping `-v1` to `-v2` re-shows the tour to everyone who already
  // saw it, which is how you deliberately re-announce a reworked flow.
  id: 'onboarding-workspace-basics-v1',

  kind: 'onboarding',

  releasedAt: '2026-07-31',

  title: () => t('tour.workspaceBasics.title'),

  // No `audience` route gate on purpose: it also drives Help-menu listing, so it
  // would hide "Product Tours" everywhere else. The route check is on the trigger.

  // Fires on its own for new signups only, subject to the engine's interruption
  // budget (once per session, never within 7 days of another tour). Feature
  // announcements should almost always use `beacon` instead.
  //
  // `is_new_user` belongs here rather than in `audience` because `audience` also
  // controls Help-menu listing — gating there would stop existing users from
  // ever replaying this. `is_new_user` is cleared once the onboarding
  // questionnaire completes (see useOnboardingFlow).
  trigger: {
    type: 'auto',
    delay: 1200,
    when: ({ route }) => {
      // Re-checked when the delay expires, not only when scheduled, so a user who
      // clicks into a base during those 1200ms doesn't get the tour on a page with
      // nothing to point at. Reuses the app's own route predicate rather than
      // restating a path shape that would drift.
      if (!isWsHomeRoute(route)) return false

      // Two paths to "this is a new user":
      //  - the questionnaire just finished and handed off (normal production flow)
      //  - `is_new_user` is still set, i.e. the questionnaire is disabled or the
      //    user reached a dashboard without going through it
      // Checking only `is_new_user` would break the first path, because
      // completing the questionnaire clears that flag before the tour host ever
      // mounts — it would fire in dev and silently never fire in production.
      return useTours().hasOnboardingHandoff() || !!useGlobal().user.value?.is_new_user
    },
  },

  // Anchors are `data-tour` values (see tours/anchors.catalog.md) — the `selector:`
  // prefix takes a raw CSS selector when no attribute exists. Steps that need a
  // specific page declare `goto` rather than assuming the user is already there.
  steps: [
    {
      // No anchor: a centered opener with no highlight.
      //
      // `goto` because the tour is listed everywhere, including inside a base
      // where three of its five anchors don't exist. `start()` applies this before
      // the first step renders, so replaying from a base lands on workspace home
      // and the whole tour is walkable rather than skipping to the last step.
      goto: ({ route, router }) => {
        if (isWsHomeRoute(route)) return

        const workspaceId = route.params.typeOrId as string

        return router.push(workspaceId ? `/${workspaceId}` : '/')
      },
      title: () => t('tour.workspaceBasics.welcome.title'),
      description: () => t('tour.workspaceBasics.welcome.description'),
    },
    {
      anchor: 'create-base',
      title: () => t('tour.workspaceBasics.createBase.title'),
      description: () => t('tour.workspaceBasics.createBase.description'),
      side: 'bottom',
      align: 'end',
    },
    {
      // The click is what opens the dropdown the next step points into; `goNext`
      // then waits for that anchor, so no `onNext` is needed.
      anchor: 'workspace-switcher',
      title: () => t('tour.workspaceBasics.switchWorkspaces.title'),
      description: () => t('tour.workspaceBasics.switchWorkspaces.description'),
      side: 'bottom',
      align: 'start',
      advanceOnClick: true,
      // CE has no workspaces, and its HomeSidebar has no selector to point at.
      when: () => isEeUI,
    },
    {
      // Inside the dropdown the previous step opens, so absent at tour start —
      // expect a `warnMissingAnchors` line for it.
      anchor: 'workspace-create',
      title: () => t('tour.workspaceBasics.moreWorkspaces.title'),
      description: () => t('tour.workspaceBasics.moreWorkspaces.description'),
      side: 'right',
      align: 'end',
      when: () => isEeUI,
    },
    {
      anchor: 'sidebar-userinfo',
      title: () => t('tour.workspaceBasics.account.title'),
      description: () => t('tour.workspaceBasics.account.description'),
      side: 'top',
      align: 'start',
    },
  ],
})
