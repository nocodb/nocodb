<script setup lang="ts">
import { ClientType, SSLUsage } from 'nocodb-sdk'
import { Action } from '../../../composables/useAccountSetupStore'
import type {
  CertTypes,
  DatabricksConnection,
  DefaultConnection,
  SQLiteConnection,
  SnowflakeConnection,
} from '../../../utils/baseCreateUtils'

const props = defineProps<{
  id: string
  modelValue?: boolean
}>()
const emit = defineEmits(['saved', 'close', 'update:modelValue'])

const vOpen = useVModel(props, 'modelValue', emit)

const {
  readPluginDetails,
  activePluginFormData: pluginFormData,
  activePlugin: plugin,
  isLoading,
  loadingAction,
  testSettings,
  saveSettings,
} = useAccountSetupStoreOrThrow()

await readPluginDetails(props.id)

const pluginTypeMap = {
  Input: FormBuilderInputType.Input,
  Select: FormBuilderInputType.Select,
  Checkbox: FormBuilderInputType.Switch,
  LongText: FormBuilderInputType.Input,
  Password: FormBuilderInputType.Password,
}

const { formState, validate, validateInfos } = useProvideFormBuilderHelper({
  formSchema: [
    ...plugin.value.formDetails.items.map((item) => ({
      type: pluginTypeMap[item.type] || FormBuilderInputType.Input,
      label: item.label,
      placeholder: item.placeholder,
      model: item.key,
      required: item.required,
      helpText: item.help_text,
    })),
  ],
  initialState: pluginFormData,
})

const doAction = async (action: Action) => {
  try {
    switch (action) {
      case Action.Save:
        await validate()
        pluginFormData.value = formState.value
        await saveSettings()
        vOpen.value = false
        break
      case Action.Test:
        await validate()
        pluginFormData.value = formState.value
        await testSettings()
        break
    }
  } catch (e: any) {
    console.log(e)
  } finally {
    loadingAction.value = null
  }
}

const isValid = computed(() => {
  return Object.values(validateInfos || {}).every((info) => info.validateStatus !== 'error')
})
</script>

<template>
  <div class="flex flex-col h-full h-[calc(100vh_-_40px)]" data-test-id="nc-setup">
    <NcPageHeader>
      <template #title>
        <span data-rec="true">
          {{ plugin.title }}
        </span>
      </template>
    </NcPageHeader>
    <div class="h-full flex  h-[calc(100%_-_48px)]">
      <div class="nc-config-left-panel nc-scrollbar-thin relative h-full flex flex-col">
        <div class="w-full flex items-center gap-3 border-b-1 border-gray-200 h-12 py-2 px-3">
          <div
            v-if="plugin.logo"
            class="mr-1 flex items-center justify-center"
            :class="[plugin.title === 'SES' ? 'p-2 bg-[#242f3e]' : '']"
          >
            <img :alt="plugin.title || 'plugin'" :src="plugin.logo" class="h-3" />
          </div>

          <span class="font-semibold text-lg">{{ plugin.formDetails.title }}</span>
          <div class="flex-grow" />

          <div class="flex gap-2">
            <NcButton
              v-for="(action, i) in plugin.formDetails.actions"
              :key="i"
              class="!px-5"
              :loading="loadingAction === action.key"
              :type="action.key === Action.Save ? 'primary' : 'default'"
              size="small"
              :disabled="!!loadingAction || !isValid"
              @click="doAction(action.key)"
            >
              {{ action.label === 'Save' ? 'Save configuration' : action.label }}
            </NcButton>
          </div>
        </div>
        <div class="h-[calc(100%_-_48px)] flex py-4 flex-col p-6  overflow-auto">
          <div v-if="isLoading || !plugin" class="flex flex-row w-full justify-center items-center h-52">
            <a-spin size="large" />
          </div>

          <div v-else class="flex">
            <NcFormBuilder class="w-150 mx-auto" />
          </div>
        </div>
      </div>
      <div class="nc-config-right-panel">
        <div class="flex-grow flex flex-col gap-3">
          <div class="text-gray-500 text-capitalize">Documentation</div>

          <div>
            <GeneralIcon icon="bookOpen" class="text-gray-500" />
            Workspace Setup
          </div>
          <div>
            <GeneralIcon icon="bookOpen" class="text-gray-500" />
            Setting up SMTP as email service
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.nc-config-left-panel {
  @apply w-full flex-1 flex justify-stretch;
}
.nc-config-right-panel {
  @apply p-5 w-[320px] border-l-1 border-gray-200 flex flex-col gap-4 bg-gray-50 rounded-br-2xl;
}
</style>
