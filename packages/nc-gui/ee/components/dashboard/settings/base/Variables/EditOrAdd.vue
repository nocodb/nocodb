<script setup lang="ts">
import { BaseVariableInheritance, BaseVariableValueType } from 'nocodb-sdk'
import type { BaseVariableType } from 'nocodb-sdk'

interface Props {
  variable?: BaseVariableType | null
  isAuthor?: boolean
  readonly?: boolean
  visible: boolean
}

const props = withDefaults(defineProps<Props>(), {
  variable: null,
  isAuthor: true,
  readonly: false,
})

const emit = defineEmits<{
  (e: 'close'): void
}>()

const { t } = useI18n()

const { createVariable, updateVariable } = useBaseVariables()

const isEdit = computed(() => !!props.variable?.id)

// Derived base mode: sandbox or managed app instance — value-only editing
const isDerivedBase = computed(() => !props.isAuthor)

const form = reactive({
  key: '',
  value: '',
  description: '',
  inheritance: BaseVariableInheritance.FIXED as BaseVariableInheritance,
  type: BaseVariableValueType.TEXT as BaseVariableValueType,
})

const isSaving = ref(false)

const modeOptions = computed(() => [
  {
    label: t('labels.inheritanceFixed'),
    description: t('labels.inheritanceFixedDesc'),
    value: BaseVariableInheritance.FIXED,
    icon: 'lock',
  },
  {
    label: t('labels.inheritanceEditable'),
    description: t('labels.inheritanceEditableDesc'),
    value: BaseVariableInheritance.EDITABLE,
    icon: 'ncEdit',
  },
  {
    label: t('labels.inheritanceRequired'),
    description: t('labels.inheritanceRequiredDesc'),
    value: BaseVariableInheritance.REQUIRED,
    icon: 'ncAlertCircle',
  },
])

const typeOptions = computed(() => [
  { label: t('general.text'), value: BaseVariableValueType.TEXT, icon: 'ncType' },
  { label: t('labels.variableSensitive'), value: BaseVariableValueType.SECRET, icon: 'lock' },
])

const isSecret = computed(() => form.type === BaseVariableValueType.SECRET)

const keyError = ref('')

const validateKey = (val: string) => {
  if (!val) {
    keyError.value = t('msg.error.variableKeyRequired')
    return false
  }

  if (!/^[A-Z][A-Z0-9_]*$/.test(val)) {
    keyError.value = t('msg.error.variableKeyFormat')
    return false
  }

  keyError.value = ''
  return true
}

const handleSave = async () => {
  if (!isEdit.value && !validateKey(form.key)) return

  isSaving.value = true
  try {
    let result
    if (isEdit.value && props.variable?.id) {
      // Skip empty value for secrets — empty means "no change" (value is masked)
      if (isSecret.value && !form.value) {
        emit('close')
        return
      }

      if (isDerivedBase.value) {
        result = await updateVariable(props.variable.id, { value: form.value })
      } else {
        result = await updateVariable(props.variable.id, {
          value: form.value,
          description: form.description,
          inheritance: form.inheritance,
          type: form.type,
        })
      }
    } else {
      result = await createVariable({
        key: form.key,
        value: form.value,
        description: form.description,
        inheritance: form.inheritance,
        type: form.type,
      })
    }

    // Only close on success — composable returns undefined on error
    if (result !== undefined) {
      emit('close')
    }
  } finally {
    isSaving.value = false
  }
}

watch(
  () => props.visible,
  (val) => {
    if (val && props.variable) {
      form.key = props.variable.key || ''
      const isMasked =
        props.variable.type === BaseVariableValueType.SECRET ||
        (!props.readonly && isDerivedBase.value && props.variable.inheritance === BaseVariableInheritance.FIXED)
      form.value = isMasked ? '' : props.variable.value || ''
      form.description = props.variable.description || ''
      form.inheritance = (props.variable.inheritance as BaseVariableInheritance) || BaseVariableInheritance.FIXED
      form.type = (props.variable.type as BaseVariableValueType) || BaseVariableValueType.TEXT
    } else if (val) {
      form.key = ''
      form.value = ''
      form.description = ''
      form.inheritance = BaseVariableInheritance.FIXED
      form.type = BaseVariableValueType.TEXT
    }
    keyError.value = ''
  },
  { immediate: true },
)
</script>

<template>
  <NcModal :visible="visible" size="small" :show-separator="true" @update:visible="emit('close')">
    <template #header>
      <div class="flex flex-row items-center gap-x-2">
        <GeneralIcon icon="ncSettings" class="w-5 h-5 text-nc-content-gray-subtle2" />
        <span class="text-base font-semibold text-nc-content-gray">
          {{
            props.readonly
              ? variable?.key
              : isEdit
              ? isDerivedBase
                ? t('labels.configureVariables')
                : `${t('general.edit')} ${variable?.key}`
              : t('labels.newVariable')
          }}
        </span>
      </div>
    </template>

    <div class="flex-1">
      <div class="space-y-4">
        <!-- Readonly info for fixed variables -->
        <NcAlert v-if="props.readonly" type="info" class="!p-3">
          <template #icon>
            <GeneralIcon icon="ncLock" class="w-4 h-4 text-nc-content-gray-subtle" />
          </template>
          <template #description>
            {{ t('labels.fixedVariableReadonly') }}
          </template>
        </NcAlert>

        <!-- Key — always show for new variables, hide only when editing on derived base -->
        <div v-if="!isDerivedBase || !isEdit">
          <label class="text-nc-content-gray text-sm font-medium mb-2 block">
            {{ t('labels.variableKey') }} <span class="text-nc-content-red-dark">*</span>
          </label>
          <a-input
            :value="form.key"
            class="rounded-lg nc-input-sm nc-input-shadow uppercase"
            :placeholder="t('placeholder.variableKey')"
            :disabled="isEdit"
            :status="keyError ? 'error' : undefined"
            autocomplete="off"
            data-testid="nc-variable-key-input"
            @input="form.key = ($event.target as HTMLInputElement).value.toUpperCase().replace(/[^A-Z0-9_]/g, '')"
            @blur="validateKey(form.key)"
          />
          <div v-if="isEdit" class="flex items-center gap-1 text-xs text-nc-content-gray-subtle2 mt-1.5">
            <GeneralIcon icon="info" class="w-3 h-3 flex-none" />
            {{ t('msg.info.variableKeyImmutable') }}
          </div>
        </div>

        <!-- Value -->
        <div>
          <label class="text-nc-content-gray text-sm font-medium mb-2 block">
            {{ t('labels.variableValue') }}
          </label>
          <template v-if="props.readonly">
            <div
              class="flex items-center gap-2 rounded-lg border-1 border-nc-border-gray-medium bg-nc-bg-gray-extralight px-3 py-2"
            >
              <span class="flex-1 text-sm text-nc-content-gray truncate" data-testid="nc-variable-value-readonly">
                {{ form.value || '-' }}
              </span>
              <GeneralCopyButton :content="form.value" :show-toast="false" icon-class="text-nc-content-gray-muted" />
            </div>
          </template>
          <template v-else>
            <a-input-password
              v-if="isSecret"
              v-model:value="form.value"
              class="!rounded-lg nc-input-shadow !text-nc-content-gray"
              :placeholder="isEdit ? '••••••••' : t('placeholder.variableValue')"
              autocomplete="off"
              data-testid="nc-variable-value-input"
            />
            <a-input
              v-else
              v-model:value="form.value"
              class="rounded-lg nc-input-sm nc-input-shadow"
              :placeholder="t('placeholder.variableValue')"
              autocomplete="off"
              data-testid="nc-variable-value-input"
            />
          </template>
        </div>

        <!-- Description -->
        <div v-if="!isDerivedBase || !isEdit">
          <label class="text-nc-content-gray text-sm font-medium mb-2 block">
            {{ t('labels.variableDescription') }}
          </label>
          <a-textarea
            v-model:value="form.description"
            class="nc-input-sm nc-input-text-area nc-input-shadow px-3 !text-nc-content-gray min-h-[80px] max-h-[120px]"
            :placeholder="t('placeholder.variableDescription')"
            data-testid="nc-variable-description-input"
          />
        </div>

        <!-- Mode + Type -->
        <div v-if="!isDerivedBase || !isEdit" class="flex gap-3">
          <div class="flex-1">
            <label class="text-nc-content-gray text-sm font-medium mb-2 flex items-center gap-1">
              {{ t('labels.variableInheritance') }}
              <NcTooltip>
                <template #title>
                  {{ t('tooltip.variableInheritance') }}
                </template>
                <GeneralIcon icon="info" class="w-3.5 h-3.5 text-nc-content-gray-subtle2 cursor-help" />
              </NcTooltip>
            </label>
            <NcSelect
              v-model:value="form.inheritance"
              class="w-full nc-variable-mode-select"
              data-testid="nc-variable-mode-select"
            >
              <a-select-option v-for="opt in modeOptions" :key="opt.value" :value="opt.value">
                <div class="flex items-start gap-2 py-0.5">
                  <GeneralIcon :icon="opt.icon" class="w-4 h-4 text-nc-content-gray-subtle mt-0.5 flex-none" />
                  <div>
                    <div class="text-nc-content-gray text-sm">{{ opt.label }}</div>
                    <div class="nc-select-dropdown-desc text-nc-content-gray-subtle2 text-xs leading-4">
                      {{ opt.description }}
                    </div>
                  </div>
                </div>
              </a-select-option>
            </NcSelect>
          </div>

          <div class="flex-1">
            <label class="text-nc-content-gray text-sm font-medium mb-2 block">
              {{ t('labels.variableType') }}
            </label>
            <NcSelect v-model:value="form.type" class="w-full" data-testid="nc-variable-type-select">
              <a-select-option v-for="opt in typeOptions" :key="opt.value" :value="opt.value">
                <div class="flex items-center gap-2">
                  <GeneralIcon :icon="opt.icon" class="w-3.5 h-3.5 text-nc-content-gray-subtle flex-none" />
                  <span>{{ opt.label }}</span>
                </div>
              </a-select-option>
            </NcSelect>
          </div>
        </div>
      </div>
    </div>

    <!-- Error + Footer -->
    <div v-if="keyError" class="flex items-center gap-2 mt-4 p-2.5 rounded-lg bg-red-50 text-nc-content-red-dark text-xs">
      <GeneralIcon icon="alertTriangle" class="w-4 h-4 flex-none" />
      {{ keyError }}
    </div>
    <div class="flex justify-end gap-2 mt-4">
      <NcButton type="secondary" size="small" @click="emit('close')">
        {{ props.readonly ? t('general.close') : t('general.cancel') }}
      </NcButton>
      <NcButton
        v-if="!props.readonly"
        type="primary"
        size="small"
        :loading="isSaving"
        data-testid="nc-variable-save-btn"
        @click="handleSave"
      >
        {{ t('general.save') }}
      </NcButton>
    </div>
  </NcModal>
</template>

<style scoped lang="scss">
:deep(.ant-form-item) {
  @apply mb-0;
}

:deep(.ant-input-password) {
  @apply nc-input-sm;
}

// Hide description text in the selected value display (only show in dropdown)
:deep(.ant-select-selection-item .nc-select-dropdown-desc) {
  @apply hidden;
}
</style>
