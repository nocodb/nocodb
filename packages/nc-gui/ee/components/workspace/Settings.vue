<script lang="ts" setup>
import { IconType, PublicAttachmentScope, WorkspaceUserRoles } from 'nocodb-sdk'

const props = defineProps<{
  workspaceId?: string
}>()

const workspaceStore = useWorkspace()
const { deleteWorkspace, navigateToWorkspace, updateWorkspace, loadWorkspace, loadWorkspaces, removeCollaborator } =
  workspaceStore
const { workspacesList, activeWorkspace, workspaces, deletingWorkspace, workspaceOwnerCount } = storeToRefs(workspaceStore)

const { orgId } = useOrganization()

const { refreshCommandPalette } = useCommandPalette()

const { isPaymentEnabled, activeSubscription, showUpgradeToUploadWsImage } = useEeConfig()

const router = useRouter()

const { isUIAllowed } = useRoles()

const { user } = useGlobal()

const { t } = useI18n()

const leavedWsUserId = ref('')

const formValidator = ref()
const isErrored = ref(false)
const isWorkspaceUpdating = ref(false)
const isDeleteModalVisible = ref(false)
// if activeworkspace.title is used it will show new workspace name in loading state
const toBeDeletedWorkspaceTitle = ref('')
const isAdminPanel = inject(IsAdminPanelInj, ref(false))

const deleteWsInputRef = ref<HTMLInputElement>()

const form = reactive<{
  title: string
  modalInput: string
  icon: string | Record<string, any>
  iconType: IconType | string
}>({
  title: '',
  modalInput: '',
  icon: '',
  iconType: '',
})

const formRules = {
  title: [
    { required: true, message: 'Workspace name required' },
    { min: 3, message: 'Workspace name must be at least 3 characters long' },
    { max: 50, message: 'Workspace name must be at most 50 characters long' },
  ],
}

const hasWorkspaceManagePermission = computed(() => {
  return isUIAllowed('workspaceManage')
})

const currentWorkspace = computedAsync(async () => {
  if (props.workspaceId) {
    const ws = workspacesList.value.find((workspace) => workspace.id === props.workspaceId)
    if (!ws && !leavedWsUserId.value) {
      await loadWorkspace(props.workspaceId)
      return workspacesList.value.find((workspace) => workspace.id === props.workspaceId)
    }
    return ws
  }
  return activeWorkspace.value
})

const imageCropperData = ref<Omit<ImageCropperProps, 'showCropper'>>({
  cropperConfig: {
    stencilProps: {
      aspectRatio: 1,
      fillDefault: true,
    },
    minHeight: 150,
    minWidth: 150,
  },
  imageConfig: {
    src: '',
    type: 'image',
    name: 'icon',
  },
  uploadConfig: {
    path: [NOCO, 'workspace', currentWorkspace.value?.id, 'icon'].join('/'),
    scope: PublicAttachmentScope.WORKSPACEPICS,
    maxFileSize: 2 * 1024 * 1024,
  },
})

const isSaveChangesBtnEnabled = computed(() => {
  return !!(form.title && form.title !== currentWorkspace.value?.title)
})

const onDelete = async () => {
  if (!currentWorkspace.value || !currentWorkspace.value.id) return

  deletingWorkspace.value = true
  try {
    const workspaceId = currentWorkspace.value.id
    // const shouldSignOut = workspacesList.value.length < 2
    await deleteWorkspace(workspaceId, { skipStateUpdate: true })
    // We only remove the delete workspace from the list after the api call is successful

    if (isAdminPanel.value) {
      router.replace({ hash: `#/admin/${orgId.value}/workspaces` })
    }

    await loadWorkspaces()
    if (!isAdminPanel.value) {
      await navigateToWorkspace(workspacesList.value?.find((ws) => ws.id !== workspaceId)?.id)

      // remove the workspace from the list after navigating to another workspace
      workspaces.value.delete(workspaceId)
    }
  } catch (e: any) {
    console.log(e)
    const msg = await extractSdkResponseErrorMsg(e)

    if (msg) {
      message.error(msg)
    }
  } finally {
    deletingWorkspace.value = false
    refreshCommandPalette()
    toBeDeletedWorkspaceTitle.value = ''
  }
}

const rules = {
  modalInput: [{ required: true, message: 'input is required.' }],
}

const saveChanges = async (isIconUpdate = false) => {
  if (!currentWorkspace.value || !currentWorkspace.value.id || isWorkspaceUpdating.value) return

  if (!isIconUpdate) {
    const valid = await formValidator.value.validate()

    if (!valid) {
      isErrored.value = true
      return
    } else {
      isErrored.value = false
    }
  }

  isWorkspaceUpdating.value = true
  isErrored.value = false

  try {
    await updateWorkspace(currentWorkspace.value?.id, {
      ...(isIconUpdate
        ? {
            meta: {
              ...(currentWorkspace.value?.meta ? currentWorkspace.value.meta : {}),
              icon: form.iconType === IconType.IMAGE && ncIsObject(form.icon) ? { ...form.icon, data: '' } : form.icon,
              iconType: form.iconType,
            },
          }
        : { title: form.title }),
    })
  } catch (e: any) {
    console.error(e)
  } finally {
    isWorkspaceUpdating.value = false
  }
}

const allowLeaveWs = computed(() => {
  /**
   * We have to allow user to leave workspace if:
   * 1. workspace has more than one owner
   * 2. user workspace role is not owner
   */
  return !!((workspaceOwnerCount.value ?? 0) > 1 || (user.value && !user.value.workspace_roles[WorkspaceUserRoles.OWNER]))
})

const handleLeaveWorkspace = () => {
  if (!user.value?.id || !currentWorkspace.value?.id) return

  removeCollaborator(user.value.id, currentWorkspace.value.id, () => {
    leavedWsUserId.value = user.value!.id
  })
}

const showCancelSubscriptionModal = () => {
  const isOpen = ref(true)

  const slots = ref({
    content: () => [
      h('div', {}, [
        h('span', {}, `${t('title.cancelSubscriptionBeforeDeletingWorkspaceSubtext')} `),
        h(
          'a',
          {
            href: 'https://nocodb.com/docs/product-docs/workspaces/billing#change-payment-method',
            target: '_blank',
          },
          `${t('msg.learnMore')}`,
        ),
      ]),
    ],
  })

  const { close } = useDialog(
    resolveComponent('NcModalConfirm'),
    {
      'visible': isOpen,
      'title': t('title.cancelSubscriptionBeforeDeletingWorkspace'),
      'okText': t('activity.navigateToBilling'),
      'cancelText': t('labels.cancel'),
      'onCancel': closeDialog,
      'onOk': async () => {
        navigateTo(`/${currentWorkspace.value?.id}/settings?tab=billing&autoScroll=plan`)

        closeDialog()
      },
      'update:visible': closeDialog,
      'showIcon': false,
      'maskClosable': true,
    },
    { slots },
  )

  function closeDialog() {
    isOpen.value = false
    close(1000)
  }
}

const shouldShowCancelSubscriptionModal = computed(() => {
  return (
    !currentWorkspace.value?.fk_org_id &&
    isPaymentEnabled.value &&
    activeSubscription.value &&
    !activeSubscription.value.canceled_at
  )
})

const handleDelete = () => {
  if (!currentWorkspace.value || !currentWorkspace.value.title) return

  // If the workspace has active subscription, then ask user to cancel the subscription first
  if (shouldShowCancelSubscriptionModal.value) {
    return showCancelSubscriptionModal()
  }

  toBeDeletedWorkspaceTitle.value = currentWorkspace.value.title
  isDeleteModalVisible.value = true

  setTimeout(() => {
    deleteWsInputRef.value?.focus()
  }, 250)
}

const handleOnBeforeTabChange = (tab: IconType) => {
  if (tab === IconType.IMAGE && showUpgradeToUploadWsImage()) {
    return false
  } else {
    return true
  }
}

watch(
  currentWorkspace,
  () => {
    form.title = form.title || (currentWorkspace.value?.title ?? '')
    form.icon = currentWorkspace.value?.meta?.icon ?? ''
    form.iconType = currentWorkspace.value?.meta?.iconType ?? ''
  },
  {
    immediate: true,
  },
)

watch(
  () => form.title,
  async () => {
    try {
      if (!currentWorkspace.value) return

      isErrored.value = !(await formValidator.value.validate())
    } catch (e: any) {
      isErrored.value = true
    }
  },
)

const onCancel = () => {
  if (currentWorkspace.value?.title) form.title = currentWorkspace.value.title
}
</script>

<template>
  <div
    class="overflow-auto nc-scrollbar-thin"
    :class="{
      'h-[calc(100vh-144px)]': isAdminPanel,
      'h-[calc(100vh-92px)]': !isAdminPanel,
    }"
  >
    <PaymentBanner v-if="!isAdminPanel" />

    <div v-if="currentWorkspace" class="flex flex-col items-center nc-workspace-settings-settings pb-10 px-6">
      <div class="nc-settings-item-card-wrapper mt-10">
        <div class="nc-settings-item-heading text-nc-content-gray-emphasis">
          {{ $t('objects.workspace') }} {{ $t('general.appearance') }}
        </div>
        <div class="nc-settings-item-card flex flex-col w-full p-6">
          <a-form ref="formValidator" layout="vertical" no-style :model="form" class="w-full" @finish="() => saveChanges()">
            <div class="flex gap-4">
              <div>
                <GeneralIconSelector
                  v-model:icon="form.icon"
                  v-model:icon-type="form.iconType"
                  v-model:image-cropper-data="imageCropperData"
                  :tab-order="[IconType.ICON, IconType.EMOJI, IconType.IMAGE]"
                  :disabled="!hasWorkspaceManagePermission"
                  @submit="() => saveChanges(true)"
                  @before-tab-change="handleOnBeforeTabChange"
                >
                  <template #default="{ isOpen }">
                    <div
                      class="rounded-lg border-1 flex-none w-17 h-17 overflow-hidden transition-all duration-300"
                      :class="{
                        'border-transparent': !isOpen && form.iconType === IconType.IMAGE,
                        'border-nc-gray-medium': !isOpen && form.iconType !== IconType.IMAGE,
                        'border-primary shadow-selected': isOpen,
                        'cursor-pointer': hasWorkspaceManagePermission,
                      }"
                    >
                      <GeneralWorkspaceIcon
                        :workspace="currentWorkspace"
                        :workspace-icon="{
                          icon: form.icon,
                          iconType: form.iconType,
                        }"
                        size="xlarge"
                        class="!w-full !h-full !min-w-full rounded-none select-none"
                        :class="{ 'cursor-pointer': hasWorkspaceManagePermission }"
                      />
                    </div>
                  </template>
                </GeneralIconSelector>
              </div>
              <div class="flex-1">
                <div class="text-sm text-nc-content-gray-subtle2">{{ $t('general.name') }}</div>
                <a-form-item name="title" :rules="formRules.title" class="!mt-2 !mb-0">
                  <a-input
                    v-model:value="form.title"
                    class="w-full !rounded-lg !px-4 h-10"
                    placeholder="Workspace name"
                    size="large"
                    :disabled="!hasWorkspaceManagePermission"
                    data-testid="nc-workspace-settings-settings-rename-input"
                  />
                </a-form-item>
              </div>
            </div>
            <div v-if="hasWorkspaceManagePermission" class="flex flex-row w-full justify-end mt-8 gap-4">
              <NcButton
                v-if="isSaveChangesBtnEnabled"
                type="secondary"
                size="small"
                data-testid="nc-workspace-settings-settings-rename-cancel"
                :disabled="isWorkspaceUpdating"
                @click="onCancel"
              >
                {{ $t('general.cancel') }}
              </NcButton>
              <NcButton
                v-e="['c:workspace:settings:rename']"
                type="primary"
                html-type="submit"
                size="small"
                :disabled="isErrored || !isSaveChangesBtnEnabled || isWorkspaceUpdating"
                :loading="isWorkspaceUpdating"
                data-testid="nc-workspace-settings-settings-rename-submit"
              >
                <template #loading> {{ $t('general.saving') }} </template>
                {{ $t('general.save') }}
              </NcButton>
            </div>
          </a-form>
        </div>
      </div>
      <div class="nc-settings-item-card-wrapper mt-10">
        <div class="nc-settings-item-heading text-nc-content-red-dark">{{ $t('labels.dangerZone') }}</div>

        <div class="nc-settings-item-card flex flex-col border-1 border-red-500 text-nc-content-gray">
          <div class="nc-settings-item">
            <div class="nc-settings-item-content">
              <div class="nc-settings-item-title">{{ $t('msg.info.leaveThisWorkspace') }}</div>
              <div class="nc-settings-item-subtitle">You will no longer have access to this workspace unless re-invited.</div>
            </div>

            <NcTooltip :disabled="allowLeaveWs">
              <template #title>
                {{ $t('tooltip.leaveWorkspace') }}
              </template>
              <NcButton
                v-e="['c:workspace:settings:leave']"
                type="secondary"
                danger
                class="nc-custom-daner-btn capitalize"
                size="small"
                :disabled="!allowLeaveWs"
                @click="handleLeaveWorkspace"
              >
                {{ $t('activity.leaveWorkspace') }}
              </NcButton>
            </NcTooltip>
          </div>
          <div v-if="hasWorkspaceManagePermission" class="nc-settings-item">
            <div class="nc-settings-item-content">
              <div class="nc-settings-item-title">{{ $t('msg.info.wsDeleteDlg') }}</div>
              <div class="nc-settings-item-subtitle">
                This will permanently remove the workspace and all its contents. This action cannot be undone.
              </div>
            </div>
            <div class="flex-none">
              <NcButton
                v-e="['c:workspace:settings:delete']"
                type="secondary"
                danger
                class="nc-custom-daner-btn"
                size="small"
                @click="handleDelete"
              >
                {{ $t('general.deleteEntity', { entity: $t('objects.workspace') }) }}
              </NcButton>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <GeneralModal
    v-if="hasWorkspaceManagePermission"
    v-model:visible="isDeleteModalVisible"
    class="nc-attachment-rename-modal"
    size="small"
    centered
  >
    <div class="flex flex-col items-center justify-center h-full !p-6">
      <div class="text-lg font-semibold self-start mb-5">Delete Workspace</div>
      <span class="self-start mb-2">
        Enter workspace name to delete - <b class="select-none"> ‘{{ toBeDeletedWorkspaceTitle }}’ </b>
      </span>
      <a-form class="w-full h-full" no-style :model="form" @finish="onDelete">
        <a-form-item class="w-full !mb-0" name="title" :rules="rules.modalInput">
          <a-input
            ref="deleteWsInputRef"
            v-model:value="form.modalInput"
            autocomplete="off"
            class="w-full nc-input-sm nc-input-shadow"
            placeholder="Workspace Name"
          />
        </a-form-item>
        <div class="flex flex-row gap-x-2 mt-2.5 pt-2.5 justify-end">
          <NcButton html-type="back" type="secondary" size="small" @click="isDeleteModalVisible = false"
            >{{ $t('general.cancel') }}
          </NcButton>
          <NcButton
            key="submit"
            v-e="['a:workspace:settings:delete']"
            html-type="submit"
            type="danger"
            size="small"
            :disabled="form.modalInput !== currentWorkspace?.title"
            :loading="deletingWorkspace"
          >
            Delete Workspace
          </NcButton>
        </div>
      </a-form>
    </div>
  </GeneralModal>
</template>
