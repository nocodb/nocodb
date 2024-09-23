<script setup lang="ts">
import { UITypes, isHiddenCol } from 'nocodb-sdk'
import { ButtonActionsType, type ButtonType, type ColumnType, type HookType } from 'nocodb-sdk'

const props = defineProps<{
  value: any
}>()

const emit = defineEmits(['update:value'])

const { t } = useI18n()

const workspaceStore = useWorkspace()
const { activeWorkspaceId } = storeToRefs(workspaceStore)

const vModel = useVModel(props, 'value', emit)

const meta = inject(MetaInj, ref())

const { isEdit, setAdditionalValidations, validateInfos, sqlUi, column, isWebhookCreateModalOpen, validate, isAiMode } =
  useColumnCreateStoreOrThrow()

const { aiIntegrationAvailable, aiError } = useNocoAi()

const uiTypesNotSupportedInFormulas = [UITypes.QrCode, UITypes.Barcode, UITypes.Button]

const webhooksStore = useWebhooksStore()

const { loadHooksList } = webhooksStore

await loadHooksList()

const { hooks } = toRefs(webhooksStore)

const isOpenConfigModal = ref<boolean>(false)


const validators = {
  ...(vModel.value.type === ButtonActionsType.Ai
    ? {
        output_column_ids: [
          {
            required: true,
            message: 'At least one output required for AI Button',
          },
        ],
        formula_raw: [
          {
            required: true,
            message: 'Prompt required for AI Button',
          },
        ],
      }
    : {}),
}

setAdditionalValidations({
  ...validators,
})

const preview = ref('')

// AI options
const availableFields = computed(() => {
  if (!meta.value?.columns) return []
  return meta.value.columns.filter((c) => c.title && !c.system && c.uidt !== UITypes.ID)
})

const outputFieldOptions = computed(() => {
  if (!meta.value?.columns) return []
  return meta.value.columns
    .filter((c) => !c.system && !c.pk && c.id !== column.value?.id)
    .map((c) => ({ label: c.title, value: c.id }))
})

const outputColumnIds = computed({
  get: () => {
    if (!vModel.value?.output_column_ids?.length) return []
    const colIds = vModel.value.output_column_ids?.split(',') || []
    return colIds
  },
  set: (val) => {
    vModel.value.output_column_ids = val.join(',')
  },
})

onMounted(() => {
  aiError.value = ''
  if (vModel.value.type === ButtonActionsType.Ai) {
    // set default value
    vModel.value.formula_raw = (column?.value?.colOptions as Record<string, any>)?.formula_raw || ''
    vModel.value.output_column_ids = (column?.value?.colOptions as Record<string, any>)?.output_column_ids || ''
  }
})
</script>

<template>
  <div class="relative flex flex-col gap-4">
    <template v-if="!aiIntegrationAvailable">
      <div v-if="!aiIntegrationAvailable" class="py-2 pl-3 pr-2 flex items-center gap-2 bg-nc-bg-orange-light rounded-lg">
        <GeneralIcon icon="alertTriangleSolid" class="!text-nc-content-orange-medium w-4 h-4" />
        <div class="text-sm text-nc-content-gray-subtle flex-1">No AI Integrations added.</div>

        <NcButton size="small" type="text" class="!text-nc-content-brand"> Add integration </NcButton>
      </div>
    </template>

    <template v-if="!!aiError"> </template>
    <template v-else>
      <NcButton
        type="secondary"
        size="small"
        class="!text-nc-content-purple-dark !bg-nc-bg-purple-light hover:!bg-nc-bg-purple-dark"
        @click.stop="isOpenConfigModal = true"
      >
        <div class="flex items-center justify-center gap-2">
          <GeneralIcon icon="ncSettings" class="text-[14px] !text-current" />
          {{ $t('general.configure') }}
        </div>
      </NcButton>
    </template>

    <a-form-item class="flex" v-bind="validateInfos.formula_raw">
      <div class="nc-prompt-input-wrapper bg-nc-bg-gray-light rounded-lg w-full">
        <AiPromptWithFields v-model="vModel.formula_raw" :options="availableFields" :auto-focus="false" />
        <div class="rounded-b-lg flex items-center gap-2 p-1">
          <GeneralIcon icon="info" class="!text-nc-content-purple-medium h-4 w-4" />
          <span class="text-xs text-nc-content-gray-subtle2"
            >Mention fields using curly braces, e.g. <span class="text-nc-content-purple-dark">{Field name}</span>.</span
          >
        </div>
      </div>
    </a-form-item>
    <a-form-item label="Output Fields" v-bind="validateInfos.output_column_ids">
      <NcSelect
        v-model:value="outputColumnIds"
        :options="outputFieldOptions"
        mode="multiple"
        placeholder="Select"
        class="nc-select-shadow nc-ai-input"
      />
    </a-form-item>

    <NcModal
      v-model:visible="isOpenConfigModal"
      class="nc-ai-button-config-modal"
      :show-separator="false"
      size="lg"
      wrap-class-name="nc-ai-button-config-modal-wrapper"
      nc-modal-class-name="!p-0"
    >
      <template #header>
        <div class="px-4 py-3">
          <div class="flex-1 flex items-center gap-2">
            <GeneralIcon icon="cellAiButton" class="flex-none h-6 w-6"/>

            {{ vModel.title }}
          </div>

          <NcButton size="small" type="primary" class="nc-extdb-btn-submit"> Add Field </NcButton>
          <NcButton size="small" type="text" @click="isOpenConfigModal = false">
            <GeneralIcon icon="close" class="text-gray-600" />
          </NcButton>
        </div>
      </template>
      <div>
        <div class="h-full flex">
          <!-- Left side -->
          <div class="h-full p-6 flex flex-col gap-6"></div>
          <!-- Right side -->
          <div class="h-full"></div>
        </div>
        <!-- Footer  -->
        <div></div>
      </div>
    </NcModal>
  </div>
</template>

<style scoped lang="scss">
:deep(.ant-form-item-label > label) {
  @apply !text-small !leading-[18px] mb-2 !text-gray-800 flex;
}

.nc-prompt-input-wrapper {
  @apply border-1 border-nc-border-gray-medium;
  box-shadow: 0px 0px 4px 0px rgba(0, 0, 0, 0.08);
}

.nc-ai-button-options-preview {
  @apply rounded-lg border-1 border-nc-border-gray-medium;
  box-shadow: 0px 0px 4px 0px rgba(0, 0, 0, 0.08);
}
</style>

<style lang="scss">
.nc-ai-button-config-modal-wrapper {
  @apply !z-1050;
}
</style>
