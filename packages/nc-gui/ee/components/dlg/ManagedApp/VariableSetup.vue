<script setup lang="ts">
import { BaseVariableValueType } from 'nocodb-sdk'
import type { BaseVariableType } from 'nocodb-sdk'

interface Props {
  visible: boolean
  variables: BaseVariableType[]
  baseId: string
  baseTitle: string
  workspaceId: string
}

const props = defineProps<Props>()

const emit = defineEmits<{
  (e: 'update:visible', val: boolean): void
  (e: 'configured'): void
}>()

const { t } = useI18n()

const { bulkUpdateValues } = useBaseVariables()

const isSaving = ref(false)

const formValues = ref<Record<string, string>>({})

// Initialize form with existing values (for overrideable vars with defaults)
watch(
  () => props.visible,
  (val) => {
    if (val) {
      const values: Record<string, string> = {}
      for (const v of props.variables) {
        values[v.id!] = v.value || ''
      }
      formValues.value = values
    }
  },
  { immediate: true },
)

const requiredVars = computed(() =>
  props.variables.filter((v) => v.inheritance === 'required' || (v.type === 'secret' && !v.value)),
)

const hasRequiredEmpty = computed(() => requiredVars.value.some((v) => !formValues.value[v.id!]))

const handleConfigure = async () => {
  isSaving.value = true
  try {
    const updates = Object.entries(formValues.value)
      .filter(([_, value]) => value)
      .map(([id, value]) => ({ id, value }))

    if (updates.length) {
      await bulkUpdateValues(props.baseId, updates, props.workspaceId)
    }

    emit('configured')
    emit('update:visible', false)
  } finally {
    isSaving.value = false
  }
}

const handleSkip = () => {
  message.info(t('msg.info.setupRequired'))
  emit('update:visible', false)
}

const isSecret = (variable: BaseVariableType) => variable.type === BaseVariableValueType.SECRET

const isRequired = (variable: BaseVariableType) => variable.inheritance === 'required'
</script>

<template>
  <NcModal :visible="visible" size="small" @update:visible="emit('update:visible', $event)">
    <template #header>
      <div class="flex items-center gap-3">
        <div class="flex items-center justify-center w-8 h-8 rounded-lg bg-nc-bg-brand">
          <GeneralIcon icon="ncKey2" class="w-4 h-4 text-nc-content-brand" />
        </div>
        <div class="flex flex-col">
          <div class="text-nc-content-gray-emphasis text-base font-bold leading-5">
            {{ t('labels.configureVariables') }}
          </div>
          <div class="text-nc-content-gray-subtle2 text-small leading-4 mt-0.5">
            {{ baseTitle }}
          </div>
        </div>
      </div>
    </template>

    <div class="flex flex-col gap-4 mt-1">
      <!-- Info banner -->
      <div class="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-nc-bg-gray-extralight border-1 border-nc-border-gray-medium">
        <GeneralIcon icon="ncAlertCircle" class="w-4 h-4 text-nc-content-gray-subtle mt-0.5 flex-none" />
        <span class="text-xs text-nc-content-gray-subtle2 leading-4">
          {{ t('msg.info.variableSetupHint', { count: variables.length }) }}
        </span>
      </div>

      <!-- Variable inputs -->
      <div class="flex flex-col gap-4">
        <div v-for="variable in variables" :key="variable.id" class="nc-variable-row">
          <label class="flex items-center gap-1.5 mb-1">
            <span class="text-bodySm text-nc-content-gray font-medium">{{ variable.key }}</span>
            <span v-if="isRequired(variable)" class="text-nc-content-red-dark text-xs font-bold">*</span>
          </label>

          <a-input
            v-model:value="formValues[variable.id!]"
            class="!rounded-lg nc-input-sm nc-input-shadow"
            :type="isSecret(variable) ? 'password' : 'text'"
            :placeholder="variable.description || t('placeholder.variableValue')"
            :data-testid="`nc-variable-setup-${variable.key}`"
          />

          <div v-if="variable.description" class="text-nc-content-gray-subtle2 text-xs mt-1">
            {{ variable.description }}
          </div>
        </div>
      </div>
    </div>

    <div class="flex mt-6 justify-end gap-2">
      <NcButton type="secondary" size="small" @click="handleSkip">
        {{ t('general.skip') }}
      </NcButton>
      <NcButton
        type="primary"
        size="small"
        :loading="isSaving"
        :disabled="hasRequiredEmpty"
        data-testid="nc-variable-setup-configure-btn"
        @click="handleConfigure"
      >
        <div class="flex items-center gap-1.5">
          <GeneralIcon icon="ncCheck" class="w-4 h-4" />
          {{ t('labels.configureVariables') }}
        </div>
      </NcButton>
    </div>
  </NcModal>
</template>

<style lang="scss" scoped>
.nc-variable-row {
  @apply flex flex-col;
}
</style>
