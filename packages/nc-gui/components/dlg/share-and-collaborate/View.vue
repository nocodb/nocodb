<script lang="ts" setup>
import { ViewLockType, type ViewType, ViewTypes } from 'nocodb-sdk'
import { useViewsStore } from '~/store/views'

const { isViewToolbar } = defineProps<{
  isViewToolbar?: boolean
}>()

const isLocked = inject(IsLockedInj, ref(false))

const route = useRoute()

const baseStore = useBase()
const { base, isPrivateBase } = storeToRefs(baseStore)
const { isUIAllowed } = useRoles()
const { activeView } = storeToRefs(useViewsStore())
const dashboardStore = useDashboardStore()
const { activeDashboard } = storeToRefs(dashboardStore)
const documentsStore = useDocumentsStore()
const { activeDocument } = storeToRefs(documentsStore)

const { $e } = useNuxtApp()

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

const inviteFormRef = ref<{
  submit: () => Promise<void>
  canSubmit: boolean
  isLoading: boolean
  recipientCount: number
} | null>(null)

/** Which tab is open. `object` is whichever of view/doc/dashboard/interface this modal was opened over. */
const activeTab = ref<'invite' | 'object'>('invite')

const isViewSharingRestricted = computed(() => {
  return isPrivateBase.value && view.value?.type !== ViewTypes.FORM
})

const isInterfaceContext = computed(() => !!route.params.interfaceId)

// Same floor as sharing the base: if you may hand out a public link to it, you
// may hand out a seat in it.
const canInvite = computed(() => isUIAllowed('baseShare') && !!base.value?.id)

const shareViewSection = computed(() => isViewToolbar && !!activeView.value)

/** The one contextual thing this modal was opened over, if any. */
const objectTab = computed<'view' | 'doc' | 'dashboard' | 'interface' | null>(() => {
  if (isInterfaceContext.value) return 'interface'
  if (activeDocument.value) return 'doc'
  if (activeDashboard.value) return 'dashboard'
  if (shareViewSection.value) return 'view'
  return null
})

// A grid and a form are shared for different reasons, so the tab names the one
// in front of you rather than the generic "view".
const viewTypeI18nKey: Partial<Record<ViewTypes, string>> = {
  [ViewTypes.GRID]: 'grid',
  [ViewTypes.GALLERY]: 'gallery',
  [ViewTypes.FORM]: 'form',
  [ViewTypes.KANBAN]: 'kanban',
  [ViewTypes.MAP]: 'map',
  [ViewTypes.CALENDAR]: 'calendar',
  [ViewTypes.LIST]: 'list',
  [ViewTypes.TIMELINE]: 'timeline',
  [ViewTypes.GANTT]: 'gantt',
}

const viewTypeLabel = computed(() => {
  const key = viewTypeI18nKey[view.value?.type as ViewTypes]

  return key ? t(`objects.viewType.${key}`).toLowerCase() : ''
})

const objectTabLabel = computed(() => {
  switch (objectTab.value) {
    case 'doc':
      return t('activity.shareDoc')
    case 'dashboard':
      return t('activity.shareDashboard')
    case 'interface':
      return t('labels.shareInterface')
    default:
      return viewTypeLabel.value ? t('activity.shareTypePublicly', { type: viewTypeLabel.value }) : t('activity.shareView')
  }
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

// The header describes the tab you're on. A static "they get an email" would be
// a plain lie on the two tabs that mint a public read-only link.
const modalTitle = computed(() => {
  if (activeTab.value === 'invite') return t('labels.bringTeamIntoBase', { base: base.value?.title })
  if (objectTab.value === 'interface') return t('labels.shareInterface')

  return t('labels.shareNamed', { name: objectTitle.value || base.value?.title })
})

const modalSubtitle = computed(() =>
  activeTab.value === 'invite' ? t('msg.info.inviteTeamSubtitle') : t('msg.info.sharePublicLinkSubtitle'),
)

// Counts only once there is something to count; an empty form must not read
// "Send 0 invites".
const sendLabel = computed(() => {
  const count = inviteFormRef.value?.recipientCount || 0
  if (!count) return t('activity.sendInvites')

  return t('activity.sendInvitesCount', count, { count })
})

const defaultTab = computed<'invite' | 'object'>(() => {
  // The interface editor's Share button is its own surface; leave it opening
  // on the thing the user pressed it for. Everywhere else, invite comes first.
  if (objectTab.value === 'interface') return 'object'

  return canInvite.value ? 'invite' : 'object'
})

function onTabChange(key: string) {
  activeTab.value = key as typeof activeTab.value
  $e('c:share:tab', { tab: key, object: objectTab.value })
}

function goToInviteTab() {
  activeTab.value = 'invite'
  $e('c:share:invite-instead')
}

function onInviteSent(emails: string[]) {
  $e('a:share:invite-sent', { count: emails.length })
  showShareModal.value = false
}

watch(showShareModal, (val) => {
  if (val) {
    activeTab.value = defaultTab.value
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
    closable
    :mask-closable="formStatus !== 'base-collaborateSaving'"
    :ok-button-props="{ hidden: true } as any"
    :cancel-button-props="{ hidden: true } as any"
    :footer="null"
    :width="formStatus === 'manageCollaborators' ? '60rem' : '40rem'"
  >
    <div class="nc-share-modal flex flex-col">
      <div class="flex flex-col gap-1 px-5 pt-4 pb-3">
        <div class="text-base font-semibold text-nc-content-gray-emphasis">{{ modalTitle }}</div>
        <div class="text-bodySm text-nc-content-gray-muted">{{ modalSubtitle }}</div>
      </div>

      <NcTabs :active-key="activeTab" class="nc-share-tabs" @update:active-key="onTabChange">
        <a-tab-pane v-if="canInvite" key="invite">
          <template #tab>
            <span data-testid="nc-share-tab-invite">{{ $t('activity.inviteTeam') }}</span>
          </template>

          <div class="nc-invite-pane px-5 pt-1 pb-4">
            <DlgInviteForm
              ref="inviteFormRef"
              :active="showShareModal && activeTab === 'invite'"
              type="base"
              :base-id="base.id"
              :show-footer="false"
              @success="onInviteSent"
              @close="showShareModal = false"
            />

            <DlgShareAndCollaborateInviteLink class="mt-5" />
          </div>
        </a-tab-pane>

        <a-tab-pane v-if="objectTab" key="object">
          <template #tab>
            <span data-testid="nc-share-tab-object">{{ objectTabLabel }}</span>
          </template>

          <div class="nc-share-pane px-2 pt-1 pb-2">
            <div v-if="objectTab === 'view'" class="share-view">
              <div
                v-if="isLocked || isViewSharingRestricted"
                class="inline-flex items-center gap-x-2 mx-3 px-1 text-nc-content-gray-muted bg-nc-bg-gray-light rounded-md"
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

              <DlgShareAndCollaborateSharePage />
            </div>

            <div v-else-if="objectTab === 'doc'" class="share-doc">
              <DlgShareAndCollaborateSharePageDoc />
            </div>

            <div v-else-if="objectTab === 'dashboard'" class="share-dashboard">
              <DlgShareAndCollaborateShareDashboard />
            </div>

            <DlgShareAndCollaborateShareInterface v-else />
          </div>
        </a-tab-pane>
      </NcTabs>

      <div class="nc-share-footer flex items-center gap-x-2 px-5 py-3 border-t-1 border-nc-border-gray-medium">
        <div class="flex-1 text-bodySm text-nc-content-gray-muted pr-2">
          <template v-if="activeTab !== 'invite' && canInvite">
            {{ $t('msg.info.shareLinksReadOnly') }}
            <!-- The whole point of the branch: the person who pressed Share meaning
                 "add my colleague" gets the right door, in the same breath as the
                 sentence that tells them a link is not it. -->
            <button
              class="nc-share-invite-instead font-medium text-nc-content-brand hover:underline"
              data-testid="nc-share-invite-instead"
              @click="goToInviteTab"
            >
              {{ $t('activity.inviteThemInstead') }}
            </button>
          </template>
        </div>

        <template v-if="activeTab === 'invite'">
          <NcButton
            type="primary"
            size="small"
            data-testid="nc-share-send-invites"
            :disabled="!inviteFormRef?.canSubmit"
            :loading="!!inviteFormRef?.isLoading"
            @click="inviteFormRef?.submit()"
          >
            {{ sendLabel }}
          </NcButton>
        </template>
        <template v-else>
          <DlgShareAndCollaborateShareInterfaceActions v-if="isEeUI" />
        </template>
      </div>
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
  .ant-modal {
    top: 10vh !important;
  }

  // a-tabs clips its content by default, which would cut off the invite form's
  // absolutely-positioned org-user picker. Panes do their own scrolling.
  .nc-share-tabs {
    @apply overflow-visible;
  }

  // The tab strip sits under the title block and above the pane, so it owns the
  // rule that used to be drawn per-section.
  .nc-share-tabs > .ant-tabs-nav {
    @apply px-3 mb-0 border-b-1 border-nc-border-gray-medium;

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
