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
const { navigateToProjectPage } = baseStore
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

const isOpeningManageAccess = ref(false)

const inviteFormRef = ref<{ submit: () => Promise<void>; canSubmit: boolean; isLoading: boolean } | null>(null)

/** Which tab is open. `object` is whichever of view/doc/dashboard/interface this modal was opened over. */
const activeTab = ref<'invite' | 'object' | 'base'>('invite')

const isViewSharingRestricted = computed(() => {
  return isPrivateBase.value && view.value?.type !== ViewTypes.FORM
})

const isInterfaceContext = computed(() => !!route.params.interfaceId)

const canShareBase = computed(() => isUIAllowed('baseShare') && !isInterfaceContext.value)

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

const objectTabLabel = computed(() => {
  switch (objectTab.value) {
    case 'doc':
      return t('activity.shareDoc')
    case 'dashboard':
      return t('activity.shareDashboard')
    case 'interface':
      return t('labels.shareInterface')
    default:
      return t('activity.shareView')
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

const defaultTab = computed<'invite' | 'object' | 'base'>(() => {
  // The interface editor's Share button is its own surface — leave it opening
  // on the thing the user pressed it for. Everywhere else, invite comes first.
  if (objectTab.value === 'interface') return 'object'
  if (canInvite.value) return 'invite'
  if (objectTab.value) return 'object'
  return 'base'
})

const openManageAccess = async () => {
  isOpeningManageAccess.value = true
  try {
    await navigateToProjectPage({ page: 'collaborator' })
    showShareModal.value = false
  } catch (e) {
    console.error(e)
    message.error('Failed to open manage access')
  } finally {
    isOpeningManageAccess.value = false
  }
}

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
    :closable="false"
    :mask-closable="formStatus !== 'base-collaborateSaving'"
    :ok-button-props="{ hidden: true } as any"
    :cancel-button-props="{ hidden: true } as any"
    :footer="null"
    :width="formStatus === 'manageCollaborators' ? '60rem' : '40rem'"
  >
    <div class="nc-share-modal flex flex-col">
      <div class="flex flex-col gap-1 px-5 pt-4 pb-3">
        <div class="text-base font-semibold text-nc-content-gray-emphasis">
          {{ canInvite ? $t('labels.bringTeamIntoBase', { base: base.title }) : $t('activity.share') }}
        </div>
        <div v-if="canInvite" class="text-bodySm text-nc-content-gray-muted">
          {{ $t('msg.info.inviteTeamSubtitle') }}
        </div>
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
              <div class="flex flex-row items-center gap-x-2 px-3 pt-2 pb-1 select-none">
                <component
                  :is="viewIcons[view?.type]?.icon"
                  class="nc-view-icon group-hover"
                  :style="{ color: viewIcons[view?.type]?.color }"
                />
                <div
                  class="max-w-79/100 px-2 py-0.5 rounded-md bg-nc-bg-gray-light capitalize text-ellipsis overflow-hidden"
                  :style="{ wordBreak: 'keep-all', whiteSpace: 'nowrap' }"
                >
                  <span>{{ objectTitle }}</span>
                </div>
              </div>
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
              <div class="flex flex-row items-center gap-x-2 px-3 pt-2 pb-1 select-none">
                <GeneralIcon icon="ncFileText" class="w-4 text-nc-content-gray-subtle !text-[16px]" />
                <div
                  class="max-w-79/100 px-2 py-0.5 rounded-md bg-nc-bg-gray-light capitalize text-ellipsis overflow-hidden"
                  :style="{ wordBreak: 'keep-all', whiteSpace: 'nowrap' }"
                >
                  <span>{{ objectTitle }}</span>
                </div>
              </div>
              <DlgShareAndCollaborateSharePageDoc />
            </div>

            <div v-else-if="objectTab === 'dashboard'" class="share-dashboard">
              <div class="flex flex-row items-center gap-x-2 px-3 pt-2 pb-1 select-none">
                <LazyGeneralEmojiPicker class="nc-dashboard-icon" size="small" :emoji="activeDashboard?.meta?.icon" readonly>
                  <template #default>
                    <GeneralIcon icon="dashboards" class="w-4 text-nc-content-gray-subtle !text-[16px]" />
                  </template>
                </LazyGeneralEmojiPicker>
                <div
                  class="max-w-79/100 px-2 py-0.5 rounded-md bg-nc-bg-gray-light capitalize text-ellipsis overflow-hidden"
                  :style="{ wordBreak: 'keep-all', whiteSpace: 'nowrap' }"
                >
                  <span>{{ objectTitle }}</span>
                </div>
              </div>
              <DlgShareAndCollaborateShareDashboard />
            </div>

            <DlgShareAndCollaborateShareInterface v-else />
          </div>
        </a-tab-pane>

        <a-tab-pane v-if="canShareBase" key="base">
          <template #tab>
            <span data-testid="nc-share-tab-base">{{ $t('activity.shareBase.label') }}</span>
          </template>

          <div class="nc-share-pane px-2 pt-1 pb-2">
            <div class="share-base">
              <div class="flex flex-row items-center gap-x-2 px-3 pt-2 pb-1 select-none">
                <GeneralProjectIcon
                  :color="parseProp(base.meta).iconColor"
                  :icon="parseProp(base.meta).icon"
                  :type="base.type"
                  :managed-app="{
                    managed_app_master: base.managed_app_master,
                    managed_app_id: base.managed_app_id,
                  }"
                  class="nc-view-icon group-hover"
                />
                <div
                  class="max-w-79/100 px-2 py-0.5 rounded-md bg-nc-bg-gray-light capitalize text-ellipsis overflow-hidden"
                  :style="{ wordBreak: 'keep-all', whiteSpace: 'nowrap' }"
                >
                  {{ base.title }}
                </div>
              </div>
              <div
                v-if="isPrivateBase"
                class="inline-flex items-center gap-x-2 mx-3 px-1 text-nc-content-gray-subtle2 bg-nc-bg-gray-light rounded-md"
              >
                <div class="flex items-center justify-center h-4 w-5">
                  <GeneralIcon icon="ncBasePrivate" class="flex-none w-3.5 h-3.5" />
                </div>
                <div class="flex-1">{{ $t('msg.privateBaseShareRestrictedMsg') }}</div>
              </div>
              <LazyDlgShareAndCollaborateShareBase />
            </div>
          </div>
        </a-tab-pane>
      </NcTabs>

      <div class="nc-share-footer flex items-center gap-x-2 px-5 py-3 border-t-1 border-nc-border-gray-medium">
        <div class="flex-1 text-bodySm text-nc-content-gray-muted pr-2">
          <template v-if="activeTab !== 'invite' && canInvite">
            {{ $t('msg.info.shareLinksReadOnly') }}
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
          <NcButton type="secondary" size="small" @click="showShareModal = false">
            {{ $t('labels.cancel') }}
          </NcButton>
          <NcButton
            type="primary"
            size="small"
            data-testid="nc-share-send-invites"
            :disabled="!inviteFormRef?.canSubmit"
            :loading="!!inviteFormRef?.isLoading"
            @click="inviteFormRef?.submit()"
          >
            {{ $t('activity.sendInvites') }}
          </NcButton>
        </template>
        <template v-else>
          <NcButton type="secondary" size="small" data-testid="docs-cancel-btn" @click="showShareModal = false">
            {{ $t('general.close') }}
          </NcButton>
          <DlgShareAndCollaborateShareInterfaceActions v-if="isEeUI" />
          <NcButton
            v-if="canShareBase"
            data-testid="docs-share-manage-access"
            size="small"
            type="secondary"
            :loading="isOpeningManageAccess"
            @click="openManageAccess"
            >{{ $t('activity.manageProjectAccess') }}
          </NcButton>
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
