<script setup lang="ts">
import type { RuleObject } from 'ant-design-vue/es/form'
import type { Form, Input } from 'ant-design-vue'
import type { VNodeRef } from '@vue/runtime-core'
import { computed } from '@vue/reactivity'
import { trimMatchingQuotes } from 'nocodb-sdk'

const props = defineProps<{
  modelValue: boolean
  isCreateNewActionMenu?: boolean
}>()

const emit = defineEmits(['update:modelValue'])

const router = useRouter()
const route = router.currentRoute

const { t } = useI18n()

const { isUIAllowed } = useRoles()

const { orgRoles, workspaceRoles, isBaseRolesLoaded } = useRoles()

const dialogShow = useVModel(props, 'modelValue', emit)

const basesStore = useBases()

const { createProject: _createProject } = basesStore

const { isSharedBase } = storeToRefs(useBase())

const { navigateToProject } = useGlobal()

const { refreshCommandPalette } = useCommandPalette()

const nameValidationRules = [
  {
    required: true,
    message: t('msg.info.dbNameRequired'),
  },
  baseTitleValidator(),
] as RuleObject[]

const form = ref<typeof Form>()

const formState = ref({
  title: '',
  meta: {
    iconColor: baseIconColors[Math.floor(Math.random() * 1000) % baseIconColors.length],
  },
})

const creating = ref(false)

const aiMode = ref<boolean | null>(null)

const modalSize = computed(() => (aiMode.value !== true ? 'small' : 'lg'))

const input: VNodeRef = ref<typeof Input>()

const aiModeInitialValue = ref({
  basePrompt: '',
  baseName: '',
})

const hasBaseCreatePermission = computed(
  () =>
    !!isBaseRolesLoaded.value &&
    isUIAllowed('baseCreate', { roles: workspaceRoles.value ?? orgRoles.value }) &&
    !isSharedBase.value,
)

const createProject = async () => {
  if (formState.value.title) {
    formState.value.title = formState.value.title.trim()
  }

  creating.value = true
  try {
    const base = await _createProject({
      title: formState.value.title,
      meta: formState.value.meta,
    })

    navigateToProject({
      baseId: base.id!,
      workspaceId: 'nc',
    })
    dialogShow.value = false
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
  } finally {
    setTimeout(() => {
      creating.value = false
    }, 500)
    refreshCommandPalette()
  }
}

const onInit = () => {
  // Clear errors
  setTimeout(async () => {
    form.value?.resetFields()

    formState.value = {
      title: 'Base',
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

/**
 * this `CreateProjectDlg` is used in multiple places and we are trying to show modal dialog based on the query params
 * So to avoid multiple dialogs being shown, we are using `isCreateNewActionMenu` props
 */
if (props.isCreateNewActionMenu) {
  watch(
    [() => route.value.query?.basePrompt, () => route.value.query?.baseName, () => hasBaseCreatePermission.value],
    ([basePrompt, baseName, hasPermission]) => {
      /**
       * Avoid showing prefilled ai base create dialog if basePrompt is not available or if dialog is already shown or if rowId is present in the query params
       */
      if (!(basePrompt as string)?.trim() || dialogShow.value || route.value.query?.rowId || !hasPermission) return

      aiModeInitialValue.value = {
        basePrompt: trimMatchingQuotes(basePrompt as string),
        baseName: trimMatchingQuotes(baseName as string),
      }

      aiMode.value = true

      dialogShow.value = true
    },
    {
      immediate: true,
    },
  )
}
</script>

<template>
  <NcModal
    :key="`${aiMode}`"
    v-model:visible="dialogShow"
    :size="modalSize"
    :width="aiMode === null ? 'auto' : undefined"
    :show-separator="false"
    :wrap-class-name="
      aiMode ? 'nc-modal-ai-base-create' : `nc-modal-wrapper ${aiMode === null ? 'nc-ai-select-base-create-mode-modal' : ''}`
    "
  >
    <template v-if="aiMode === false" #header>
      <!-- Create A New Table -->
      <div class="flex flex-row items-center text-base text-nc-content-gray">
        <GeneralProjectIcon :color="formState.meta.iconColor" class="mr-2.5" />
        {{
          $t('general.createEntity', {
            entity: 'Base',
          })
        }}
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
          class="w-full !mx-auto"
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
        </a-form>

        <div class="flex flex-row justify-end mt-5 gap-x-2">
          <NcButton type="secondary" size="small" :disabled="creating" @click="dialogShow = false">{{
            $t('general.cancel')
          }}</NcButton>
          <NcButton
            v-e="['a:base:create']"
            data-testid="docs-create-proj-dlg-create-btn"
            :loading="creating"
            type="primary"
            size="small"
            :disabled="creating"
            :label="`${$t('general.create')} Base`"
            :loading-label="`${$t('general.creating')} Base`"
            @click="createProject"
          >
            {{
              $t('general.createEntity', {
                entity: 'Base',
              })
            }}
            <template #loading>
              {{
                $t('general.creatingEntity', {
                  entity: 'Base',
                })
              }}
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
