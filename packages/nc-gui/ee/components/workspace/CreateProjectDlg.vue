<script setup lang="ts">
import type { RuleObject } from 'ant-design-vue/es/form'
import type { Form, Input } from 'ant-design-vue'
import { computed } from '@vue/reactivity'
import { PlanFeatureTypes, PlanTitles, ProjectRoles } from 'nocodb-sdk'

const props = defineProps<{
  modelValue: boolean
  isCreateNewActionMenu?: boolean
}>()

const emit = defineEmits(['update:modelValue'])

const router = useRouter()
const route = router.currentRoute

const dialogShow = useVModel(props, 'modelValue', emit)

const { t } = useI18n()

const workspaceStore = useWorkspace()
const { activeWorkspace } = storeToRefs(workspaceStore)

const basesStore = useBases()
const { createProject: _createProject } = basesStore

const { refreshCommandPalette } = useCommandPalette()

const { navigateToProject } = useGlobal()

const { blockPrivateBases, showUpgradeToUsePrivateBases, isOnPrem } = useEeConfig()

const nameValidationRules = [
  {
    required: true,
    message: 'Database name is required',
  },
  baseTitleValidator(),
] as RuleObject[]

const form = ref<typeof Form>()

const formState = ref({
  title: '',
  default_role: '' as NcProject['default_role'],
  meta: {
    iconColor: baseIconColors[Math.floor(Math.random() * 1000) % baseIconColors.length],
  },
})

const creating = ref(false)

const createProject = async () => {
  if (formState.value.title) {
    formState.value.title = formState.value.title.trim()
  }

  creating.value = true
  try {
    const base = await _createProject({
      title: formState.value.title,
      workspaceId: activeWorkspace.value!.id!,
      meta: formState.value.meta,
      ...(!blockPrivateBases.value ? { default_role: formState.value.default_role } : {}),
    })

    navigateToProject({
      baseId: base.id!,
      workspaceId: activeWorkspace.value!.id!,
    })

    refreshCommandPalette()

    dialogShow.value = false
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
  } finally {
    setTimeout(() => {
      creating.value = false
    }, 500)
  }
}

const aiMode = ref<boolean | null>(null)

const modalSize = computed(() => (aiMode.value !== true ? 'small' : 'lg'))

const input = ref<typeof Input>()

const aiModeInitialValue = ref({
  basePrompt: '',
  baseName: '',
})

const onInit = () => {
  // Clear errors
  setTimeout(async () => {
    form.value?.resetFields()

    formState.value = {
      title: t('objects.project'),
      default_role: '',
      meta: {
        iconColor: baseIconColors[Math.floor(Math.random() * 1000) % baseIconColors.length],
      },
    }

    await nextTick()

    input.value?.$el?.focus()
    input.value?.$el?.select()
  }, 5)
}

const handleResetInitialValue = () => {
  // Avoid unnecessary reset of initial value
  if (!aiModeInitialValue.value.basePrompt && !route.value?.query?.basePrompt) return

  aiModeInitialValue.value = {
    basePrompt: '',
    baseName: '',
  }

  /**
   * We don't want to trigger route change here, so we are using `removeQueryParamsFromURL`
   */
  removeQueryParamsFromURL(['basePrompt', 'baseName'])
}

watch(dialogShow, async (n, o) => {
  if (n === o && !n) return

  // If ai prompt is set, don't reset the aiMode value
  if (n && aiModeInitialValue.value.basePrompt) return

  if (!n) {
    handleResetInitialValue()
  }

  aiMode.value = null
})

watch(aiMode, () => {
  if (aiMode.value !== false) return

  onInit()
})

const isOpenBaseAccessDropdown = ref(false)

const baseAccessValue = computed({
  get: () => formState.value.default_role ?? '',
  set: (value) => {
    // If private base is selected and user don't have access to it then don't allow to select it
    if (
      value === ProjectRoles.NO_ACCESS &&
      showUpgradeToUsePrivateBases({
        callback: (type) => {
          if (type === 'ok') {
            dialogShow.value = false
          }
        },
      })
    )
      return

    formState.value.default_role = value === ProjectRoles.NO_ACCESS ? ProjectRoles.NO_ACCESS : ''
  },
})

const baseAccessOptions = computed(
  () =>
    [
      {
        label: t('labels.defaultType'),
        value: '',
        icon: 'ncBaseOutline',
        subtext: t('title.baseTypeDefaultSubtext'),
      },
      {
        label: t('labels.privateType'),
        value: ProjectRoles.NO_ACCESS,
        icon: 'ncBasePrivate',
        subtext: t('title.baseTypePrivateSubtext'),
      },
    ] as (NcListItemType & { icon: IconMapKey })[],
)

const selectedBaseAccessOption = computed(() => {
  return baseAccessOptions.value.find((option) => option.value === (formState.value.default_role?.toString() || ''))!
})

const privateBaseMinPlanReq = computed(() => (isOnPrem.value ? PlanTitles.ENTERPRISE : PlanTitles.BUSINESS))

/**
 * this `CreateProjectDlg` is used in multiple places and we are trying to show modal dialog based on the query params
 * So to avoid multiple dialogs being shown, we are using `isCreateNewActionMenu` props
 */
if (props.isCreateNewActionMenu) {
  watch([() => route.value.query?.basePrompt, () => route.value.query?.baseName], ([basePrompt, baseName]) => {
    /**
     * Avoid showing prefilled ai base create dialog if basePrompt is not available or if dialog is already shown or if rowId is present in the query params
     */
    if (!(basePrompt as string)?.trim() || dialogShow.value || route.value.query?.rowId) return

    aiModeInitialValue.value = {
      basePrompt: (basePrompt as string)?.trim() || '',
      baseName: (baseName as string)?.trim() || '',
    }

    aiMode.value = true

    dialogShow.value = true
  })
}
</script>

<template>
  <NcModal
    :key="`${aiMode}`"
    v-model:visible="dialogShow"
    :size="modalSize"
    :show-separator="false"
    :width="aiMode === null ? 'auto' : undefined"
    :wrap-class-name="
      aiMode ? 'nc-modal-ai-base-create' : `nc-modal-wrapper ${aiMode === null ? 'nc-ai-select-base-create-mode-modal' : ''}`
    "
  >
    <template v-if="aiMode === false" #header>
      <!-- Create A New Table -->
      <div class="flex flex-row items-center text-base text-gray-800">
        <GeneralProjectIcon :color="formState.meta.iconColor" class="mr-2.5" />
        {{ $t('general.create') }} {{ $t('objects.project') }}
      </div>
    </template>
    <template v-if="aiMode === null">
      <WorkspaceProjectCreateMode v-model:ai-mode="aiMode" />
    </template>
    <template v-if="aiMode === false">
      <div class="mt-1">
        <a-form
          ref="form"
          :model="formState"
          name="basic"
          layout="vertical"
          class="w-full !mx-auto flex flex-col gap-5"
          no-style
          autocomplete="off"
          @finish="createProject"
        >
          <a-form-item name="title" :rules="nameValidationRules" class="!mb-0">
            <a-input
              ref="input"
              v-model:value="formState.title"
              name="title"
              class="nc-metadb-base-name nc-input-sm nc-input-shadow"
              placeholder="Title"
            />
          </a-form-item>

          <a-form-item name="default_role" class="!mb-0">
            <template #label>
              <div>{{ t('general.baseType') }}</div>
            </template>
            <NcListDropdown v-model:is-open="isOpenBaseAccessDropdown">
              <div class="flex-1 flex items-center gap-2 text-nc-content-gray">
                <GeneralIcon :icon="selectedBaseAccessOption.icon" class="flex-none h-3.5 w-3.5" />
                <span class="text-sm flex-1">{{ selectedBaseAccessOption.label }}</span>

                <GeneralIcon
                  icon="ncChevronDown"
                  class="flex-none h-4 w-4 transition-transform opacity-80"
                  :class="{ 'transform rotate-180': isOpenBaseAccessDropdown }"
                />
              </div>
              <template #overlay="{ onEsc }">
                <NcList
                  v-model:open="isOpenBaseAccessDropdown"
                  v-model:value="baseAccessValue"
                  :list="baseAccessOptions"
                  :item-height="48"
                  class="!w-auto"
                  wrapper-class-name="!h-auto"
                  @escape="onEsc"
                >
                  <template #listItem="{ option, isSelected }">
                    <div class="w-full flex flex-col">
                      <div class="w-full flex items-center justify-between">
                        <div class="flex items-center gap-2 text-nc-content-gray">
                          <div class="flex items-center justify-center h-4 w-4">
                            <GeneralIcon :icon="option.icon" class="flex-none h-3.5 w-3.5" />
                          </div>
                          <span class="text-captionDropdownDefault !font-550">{{ option.label }}</span>
                        </div>

                        <PaymentUpgradeBadge
                          v-if="blockPrivateBases && option.value === ProjectRoles.NO_ACCESS"
                          :feature="PlanFeatureTypes.FEATURE_PRIVATE_BASES"
                          :plan-title="privateBaseMinPlanReq"
                          remove-click
                        />
                        <GeneralIcon v-else-if="isSelected" icon="check" class="text-primary h-4 w-4" />
                      </div>
                      <div class="text-bodySm text-nc-content-gray-muted ml-6">{{ option.subtext }}</div>
                    </div>
                  </template>
                </NcList>
              </template>
            </NcListDropdown>
          </a-form-item>
        </a-form>

        <div class="flex flex-row justify-end mt-5 gap-x-2">
          <NcButton type="secondary" size="small" :disabled="creating" @click="dialogShow = false">{{
            $t('labels.cancel')
          }}</NcButton>
          <NcButton
            v-e="['a:base:create']"
            data-testid="docs-create-proj-dlg-create-btn"
            :loading="creating"
            type="primary"
            size="small"
            :disabled="creating"
            :label="`Create ${t('objects.project')}`"
            :loading-label="`Creating ${t('objects.project')}`"
            @click="createProject"
          >
            {{ $t('general.createEntity', { entity: t('objects.project') }) }}
            <template #loading>
              {{ $t('general.creatingEntity', { entity: t('objects.project') }) }}
            </template>
          </NcButton>
        </div>
      </div>
    </template>
    <template v-if="aiMode === true">
      <WorkspaceProjectAiCreateProject
        v-model:ai-mode="aiMode"
        v-model:dialog-show="dialogShow"
        :is-create-new-action-menu="isCreateNewActionMenu"
        :workspace-id="activeWorkspace.id"
        :initial-value="aiModeInitialValue"
      />
    </template>
  </NcModal>
</template>

<style lang="scss">
.nc-modal-ai-base-create .ant-modal-content {
  .nc-modal {
    @apply !p-0;

    .nc-modal-header {
      @apply mb-0 px-4 py-2 items-center gap-3;
    }

    .ant-checkbox {
      @apply !shadow-none;
    }
  }
}

.nc-modal-wrapper.nc-ai-select-base-create-mode-modal {
  .ant-modal-content {
    @apply !rounded-[24px];
  }
}
</style>
