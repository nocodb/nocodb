<script lang="ts" setup>
import { InviteLinkScope, ProjectRoles, ViewLockType, type ViewType, ViewTypes } from 'nocodb-sdk'
import { useViewsStore } from '~/store/views'

const { isViewToolbar } = defineProps<{
  isViewToolbar?: boolean
}>()

const isLocked = inject(IsLockedInj, ref(false))

const route = useRoute()

const baseStore = useBase()
const { base, isPrivateBase } = storeToRefs(baseStore)
const { isUIAllowed, baseRoles } = useRoles()
const { activeView } = storeToRefs(useViewsStore())
const dashboardStore = useDashboardStore()
const { activeDashboard } = storeToRefs(dashboardStore)
const documentsStore = useDocumentsStore()
const { activeDocument } = storeToRefs(documentsStore)

const { $e, $api } = useNuxtApp()

const { t } = useI18n()

let view: Ref<ViewType | undefined>
if (isViewToolbar) {
  try {
    const store = useSmartsheetStoreOrThrow()
    view = store.view
  } catch (_e) {
    // console.error(e)
  }
}

const { formStatus, showShareModal } = storeToRefs(useShare())
const { resetData } = useShare()

const { links: inviteLinks, load: loadInviteLinks } = useInviteLinks()

const { navigateToProjectPage } = baseStore

/** Which tab is open. `object` is whichever of view/doc/dashboard/interface this modal was opened over. */
const activeTab = ref<'invite' | 'object'>('invite')

/**
 * The hub pushes into focused screens rather than growing. `main` is the tab
 * pair; the rest are single-purpose and return with a back arrow.
 */
const screen = ref<'main' | 'compose' | 'links' | 'edit'>('main')

const editLinkId = ref('')

const editLinkIsNew = ref(false)

const memberCount = ref(0)

/** "0 people have access" is a lie while the request is still out. */
const membersLoaded = ref(false)

/**
 * Only the count is on screen, so read the total off the pagination metadata
 * rather than counting rows. `limit` is passed but this endpoint ignores it
 * today, so the payload is not yet smaller -- the win is that getBaseUsers is
 * no longer called with force: true, which refetched on every open and
 * rewrote the shared cache other screens read.
 *
 * Deliberately not awaited by the opener: the modal paints immediately and the
 * footer swaps its skeleton for the number whenever this lands.
 */
async function loadMemberCount() {
  if (!base.value?.id) return

  try {
    const res: any = await $api.auth.baseUserList(base.value.id, { query: { limit: 1 } } as any)

    memberCount.value = res?.users?.pageInfo?.totalRows ?? 0
    membersLoaded.value = true
  } catch (e) {
    // The line is a doorway to the members page; a failure here must not take
    // the modal down with it, but it should not be silent either.
    console.error(e)
    memberCount.value = 0
  }
}

const isViewSharingRestricted = computed(() => {
  return isPrivateBase.value && view.value?.type !== ViewTypes.FORM
})

const isInterfaceContext = computed(() => !!route.params.interfaceId)

// Anyone who can actually invite sees the tab. Since 2026-09-19 that is every
// member from Viewer up, who may invite by email; minting a link is Editor and
// above, and the link block gates itself on that.
/**
 * On a private base, handing out access is the owner's alone -- the same rule
 * user management follows there, and what the backend enforces. Everyone else
 * sees only the Share to web tab, with view sharing disabled.
 */
const canInvite = computed(() => {
  if (!base.value?.id) return false

  if (isPrivateBase.value) return !!baseRoles.value?.[ProjectRoles.OWNER]

  return isUIAllowed('userInvite') || isUIAllowed('baseInviteLinkCreate')
})

const shareViewSection = computed(() => isViewToolbar && !!activeView.value)

/** The one contextual thing this modal was opened over, if any. */
const objectTab = computed<'view' | 'doc' | 'dashboard' | 'interface' | null>(() => {
  if (isInterfaceContext.value) return 'interface'
  if (activeDocument.value) return 'doc'
  if (activeDashboard.value) return 'dashboard'
  if (shareViewSection.value) return 'view'
  return null
})

const objectTitle = computed(() => {
  switch (objectTab.value) {
    case 'doc':
      return activeDocument.value?.title || t('general.untitled')
    case 'dashboard':
      return activeDashboard.value?.title
    case 'view':
      return activeView.value?.title
    default:
      return ''
  }
})

/** The card header the design puts above the toggle. */
const objectHeading = computed(() => ({
  title: t('msg.info.publicLinkToNamed', { name: objectTitle.value || base.value?.title }),
  subtitle: t('msg.info.sharePublicLinkSubtitle'),
}))

/** What the second tab actually publishes: the thing you are looking at. */
const objectNoun = computed(() => {
  switch (objectTab.value) {
    case 'doc':
      return t('objects.document').toLowerCase()
    case 'dashboard':
      return t('objects.dashboard').toLowerCase()
    case 'interface':
      return t('general.interface').toLowerCase()
    default:
      return t('objects.view').toLowerCase()
  }
})

/** Share-to-web for a whole base lives in the base menu now, so off a view the
 *  modal is invite-only and must not promise a web link. Where there is a web
 *  tab it publishes that one object, not the base, so the tooltip names it. */
const shareHubTooltip = computed(() =>
  objectTab.value ? t('msg.info.shareHubTooltip', { object: objectNoun.value }) : t('msg.info.shareHubTooltipInviteOnly'),
)

/**
 * Publishing a view is Editor and above; the other object kinds gate themselves
 * inside their own components. Without this a viewer saw a Share to web tab
 * over a view they may not publish.
 */
const canShareObject = computed(() => (objectTab.value === 'view' ? isUIAllowed('viewShare') : !!objectTab.value))

const defaultTab = computed<'invite' | 'object'>(() => {
  // The interface editor's Share button is its own surface; leave it opening
  // on the thing the user pressed it for. Everywhere else, invite comes first.
  if (objectTab.value === 'interface') return 'object'

  return canInvite.value ? 'invite' : 'object'
})

const screenTitle = computed(() => {
  if (screen.value === 'links') return t('activity.inviteLinks')
  if (screen.value === 'edit') return t(editLinkIsNew.value ? 'activity.newInviteLink' : 'activity.editInviteLink')

  return t('labels.shareNamed', { name: base.value?.title })
})

const MODAL_WIDTH = 560

/**
 * Open under the Share button rather than in the middle of the screen: the
 * pointer is already at the button, so the first click inside the modal is a
 * few pixels away instead of a trip to the centre. Falls back to centred when
 * the trigger cannot be found (interface editor, keyboard shortcut).
 */
function anchorToTrigger() {
  const trigger = document.querySelector('[data-testid="share-base-button"]') as HTMLElement | null
  const root = document.documentElement
  const gutter = 12

  // No trigger to hang off: place it where ant would have, in pixels, so the CSS
  // needs no second placement rule.
  const rect = trigger?.getBoundingClientRect()
  const top = rect ? rect.bottom + 8 : window.innerHeight * 0.1
  const right = rect ? rect.right : (window.innerWidth + MODAL_WIDTH) / 2
  const left = Math.max(gutter, Math.min(right - MODAL_WIDTH, window.innerWidth - MODAL_WIDTH - gutter))

  root.style.setProperty('--nc-share-anchor-top', `${Math.round(top)}px`)
  root.style.setProperty('--nc-share-anchor-left', `${Math.round(left)}px`)
}

function goMain() {
  screen.value = 'main'
}

function openCompose() {
  screen.value = 'compose'
  $e('c:invite:base:email:compose')
}

function openLinks() {
  screen.value = 'links'
  $e('c:invite:base:link:list:open')
}

/** Back to the list when there is a list to go back to, otherwise the hub. */
function afterEditLink() {
  screen.value = inviteLinks.value.length > 1 ? 'links' : 'main'
}

function openEditLink(linkId: string, isNew = false) {
  $e('c:invite:base:link:settings:open', { isNew })

  editLinkId.value = linkId
  editLinkIsNew.value = isNew
  screen.value = 'edit'
}

/** The hub's people row is a doorway to the real members page. */
async function openManageAccess() {
  $e('c:share:members:open')

  try {
    await navigateToProjectPage({ page: 'collaborator' })
    showShareModal.value = false
  } catch (e) {
    console.error(e)
  }
}

function onTabChange(key: string) {
  activeTab.value = key as typeof activeTab.value
  $e('c:share:tab:switch', { tab: key, object: objectTab.value })
}

function goToInviteTab() {
  activeTab.value = 'invite'
  $e('c:share:tab:switch', { tab: 'invite', object: objectTab.value, via: 'cta' })
}

// Closing is the form's call, not ours: it keeps itself open when something is
// still sitting in the box waiting to be corrected.
function onInviteSent(emails: string[]) {
  $e('a:invite:base:email:send', { count: emails.length })
  loadMemberCount()
}

/**
 * Ant dismisses the modal from a keydown on its own wrapper, which only fires
 * while focus is inside it. Toggling share-to-web or saving a view password
 * unmounts the control that had focus, focus falls back to `<body>`, and Escape
 * silently stops working — and with `closable: false` and no Cancel, the mask is
 * then the only way out. Listening on the window keeps Escape the dismissal it
 * is documented to be, wherever focus ended up.
 */
onKeyStroke('Escape', (e) => {
  if (!showShareModal.value || e.defaultPrevented) return

  // A dropdown or picker layered over the modal owns Escape first.
  if (
    document.querySelector(
      '.ant-select-dropdown:not(.ant-select-dropdown-hidden), .ant-dropdown:not(.ant-dropdown-hidden), .ant-picker-dropdown:not(.ant-picker-dropdown-hidden)',
    )
  ) {
    return
  }

  showShareModal.value = false
})

watch(showShareModal, (val) => {
  if (val) {
    screen.value = 'main'
    activeTab.value = defaultTab.value
    membersLoaded.value = false
    nextTick(anchorToTrigger)
    loadMemberCount()
    // Forced: the cached list is whatever this tab last saw, so a link created
    // or revoked anywhere else -- another tab, another person -- would still be
    // on screen, and its Copy button would hand out a dead token.
    // Only ask for what this caller may see. Links are Editor and above, and a
    // viewer opening the hub would otherwise be met by a 403 toast about a
    // section they cannot even see.
    //
    // `baseInviteLinkCreate`, not `...List`: the frontend ACL only defines the
    // former, so guarding on the latter was false for everyone and left the
    // composable without a target -- which made Create an invite link do
    // nothing at all, silently.
    if (base.value?.id && isUIAllowed('baseInviteLinkCreate')) {
      loadInviteLinks({ scope: InviteLinkScope.BASE, baseId: base.value.id }, true)
    }
    $e('c:share:open', { tab: activeTab.value, object: objectTab.value })
  } else {
    setTimeout(() => {
      resetData()
    }, 500)
  }
})
</script>

<template>
  <a-modal
    v-model:visible="showShareModal"
    class="!top-[1%]"
    :class="{ active: showShareModal }"
    wrap-class-name="nc-modal-share-collaborate"
    :closable="false"
    :keyboard="formStatus !== 'base-collaborateSaving'"
    :mask-closable="formStatus !== 'base-collaborateSaving'"
    :ok-button-props="{ hidden: true } as any"
    :cancel-button-props="{ hidden: true } as any"
    :footer="null"
    width="35rem"
  >
    <div class="nc-share-modal flex flex-col">
      <!-- Hub. Two tabs, and the screens push off it. -->
      <template v-if="screen === 'main'">
        <div class="flex items-center gap-2 px-7 pt-6">
          <div class="text-heading3 !text-[18px] font-bold tracking-tight text-nc-content-gray-emphasis">
            {{ $t('labels.shareNamed', { name: base.title }) }}
          </div>
          <NcTooltip :title="shareHubTooltip" placement="top">
            <GeneralIcon icon="info" class="w-4.5 h-4.5 text-nc-content-gray-muted cursor-help" />
          </NcTooltip>
        </div>

        <!-- Both tabs can be absent at once: a creator on a private base may not
             invite, and off a view there is nothing to publish. Saying so beats
             an empty dialog with only a title in it. -->
        <div v-if="!canInvite && !canShareObject" class="px-7 pb-7 pt-2 text-bodyDefault text-nc-content-gray-subtle2">
          {{ isPrivateBase ? $t('msg.info.shareNothingPrivateBase') : $t('msg.info.shareNothingToShow') }}
        </div>

        <NcTabs v-else :active-key="activeTab" class="nc-share-tabs" @update:active-key="onTabChange">
          <a-tab-pane v-if="canInvite" key="invite">
            <template #tab>
              <span data-testid="nc-share-tab-invite">{{ $t('activity.inviteTeam') }}</span>
            </template>

            <DlgShareAndCollaborateHubMain
              :member-count="memberCount"
              :members-loaded="membersLoaded"
              @compose="openCompose"
              @links="openLinks"
              @edit-link="openEditLink"
              @manage-access="openManageAccess"
            />
          </a-tab-pane>

          <a-tab-pane v-if="canShareObject" key="object">
            <template #tab>
              <span data-testid="nc-share-tab-object">{{ $t('activity.shareToWeb') }}</span>
            </template>

            <div class="nc-share-pane px-7 pt-5 pb-7 flex flex-col gap-4">
              <div v-if="objectTab === 'view'" class="share-view flex flex-col gap-3">
                <div
                  v-if="isLocked || isViewSharingRestricted"
                  class="inline-flex items-center gap-x-2 px-2 py-1 text-nc-content-gray-muted bg-nc-bg-gray-light rounded-md"
                >
                  <div v-if="isViewSharingRestricted" class="flex items-center justify-center h-4 w-4">
                    <GeneralIcon icon="ncBasePrivate" class="flex-none w-3.5 h-3.5" />
                  </div>
                  <component
                    :is="viewLockIcons[view.lock_type].icon"
                    v-if="!isViewSharingRestricted"
                    class="flex-none"
                    :class="{
                      'w-4 h-4': view?.lock_type === ViewLockType.Locked,
                      'w-3.5 h-3.5': view?.lock_type !== ViewLockType.Locked,
                    }"
                  />

                  <div class="flex-1">
                    {{
                      isViewSharingRestricted
                        ? $t('msg.privateBaseViewShareRestrictedMsg')
                        : $t('title.viewSettingsCantBeChangedWhenViewIs', {
                            type: $t(viewLockIcons[activeView?.lock_type]?.title).toLowerCase(),
                          })
                    }}
                  </div>
                </div>

                <DlgShareAndCollaborateSharePage :heading="objectHeading">
                  <template #icon>
                    <div
                      class="w-7 h-7 flex-none rounded-md bg-nc-bg-gray-light flex items-center justify-center text-nc-content-gray-subtle"
                    >
                      <component :is="viewIcons[view?.type]?.icon" class="w-4 h-4" />
                    </div>
                  </template>
                </DlgShareAndCollaborateSharePage>
              </div>

              <div v-else-if="objectTab === 'doc'" class="share-doc">
                <DlgShareAndCollaborateSharePageDoc />
              </div>

              <div v-else-if="objectTab === 'dashboard'" class="share-dashboard">
                <DlgShareAndCollaborateShareDashboard />
              </div>

              <DlgShareAndCollaborateShareInterface v-else />

              <div v-if="canInvite" class="text-bodySm text-nc-content-gray-muted">
                {{ $t('msg.info.readOnlyInviteInstead') }}
                <button
                  class="nc-share-invite-instead font-semibold text-nc-content-brand hover:underline"
                  data-testid="nc-share-invite-instead"
                  @click="goToInviteTab"
                >
                  {{ $t('activity.inviteThemInstead') }}
                </button>
              </div>
            </div>
          </a-tab-pane>
        </NcTabs>
      </template>

      <!-- Sub-screens. Same modal, one job each, back arrow to the hub. -->
      <template v-else>
        <div class="flex items-center gap-2 px-6 pt-6">
          <NcButton type="text" size="xsmall" class="!px-1" data-testid="nc-hub-back" @click="goMain">
            <GeneralIcon icon="ncArrowLeft" class="w-5 h-5" />
          </NcButton>
          <div class="flex-1 text-heading3 !text-[18px] font-bold tracking-tight text-nc-content-gray-emphasis">
            {{ screenTitle }}
          </div>
        </div>

        <DlgShareAndCollaborateHubCompose
          v-if="screen === 'compose'"
          :active="showShareModal && screen === 'compose'"
          :base-id="base.id"
          @back="goMain"
          @sent="onInviteSent"
        />

        <DlgShareAndCollaborateHubLinks v-else-if="screen === 'links'" @edit-link="openEditLink" />

        <DlgShareAndCollaborateHubEditLink v-else :link-id="editLinkId" :is-new="editLinkIsNew" @done="afterEditLink" />
      </template>
    </div>
  </a-modal>
</template>

<style lang="scss" scoped>
.share-collapse-item {
  @apply !rounded-lg !mb-2 !mt-4 !border-0;
}

.ant-collapse {
  @apply !bg-nc-bg-default !border-0;
}

.nc-share-pane {
  @apply max-h-[60vh] overflow-y-auto nc-scrollbar-thin;
}

// No scroll container here on purpose: the invite form's org-user picker is
// absolutely positioned and a clipping ancestor would cut it off.
.nc-invite-pane {
  @apply overflow-visible;
}
</style>

<style lang="scss">
.nc-modal-share-collaborate {
  // Anchored under the Share button when we know where it is; the fallbacks
  // reproduce ant's centred placement.
  .ant-modal {
    position: absolute;
    top: var(--nc-share-anchor-top, 10vh) !important;
    left: var(--nc-share-anchor-left, 0);
    margin: 0 !important;
    padding-bottom: 0 !important;
    transform-origin: top right !important;
  }

  // Disabled still has to look like a button: the default treatment fades it
  // into the footer, so people cannot see what they are working towards.
  .nc-share-send-invites[disabled],
  .nc-share-send-invites.nc-disabled,
  .nc-share-send-invites:disabled {
    @apply !bg-nc-bg-brand !text-nc-content-brand-disabled !border-transparent opacity-100;
  }

  // a-tabs clips its content by default, which would cut off the invite form's
  // absolutely-positioned org-user picker. Panes do their own scrolling.
  .nc-share-tabs {
    @apply overflow-visible;
  }

  // The tab strip sits under the title block and above the pane, so it owns the
  // rule that used to be drawn per-section.
  .nc-share-tabs > .ant-tabs-nav {
    // NcTabs pads each tab by 8px, so the nav pads 20px to land the first tab's
    // text on the same 28px gutter as the heading above it.
    // No top margin: ant already pads the tab 12px, which is the whole gap.
    @apply pl-5 pr-12 mb-0 border-b-1 border-nc-border-gray-medium;

    &::before {
      @apply border-0;
    }
  }

  .ant-collapse-item {
    @apply !border-1 border-nc-border-gray-light;
  }

  .ant-collapse-content {
    @apply !border-t-0;
  }

  .ant-collapse-content-box {
    @apply !p-0;
  }

  .ant-modal-content {
    @apply !rounded-lg !p-0;
  }

  .ant-modal-body {
    @apply !p-0;
  }

  .ant-select-selector {
    @apply !rounded-md !border-nc-border-gray-medium !border-1;
  }

  .ant-form-item {
    @apply !my-0;
  }

  .ant-form-item-explain {
    @apply !ml-3;
  }

  .ant-select {
    @apply !p-0.5;
  }

  .ant-select-selector {
    @apply !bg-nc-bg-default;
  }
}
</style>
