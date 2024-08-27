<script setup lang="ts">
import { Action } from '../../../composables/useAccountSetupStore'

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

const { formState, validate } = useProvideFormBuilderHelper({
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
</script>

<template>
  <NcModal :visible="vOpen" centered width="70rem" wrap-class-name="nc-modal-create-source" @keydown.esc="vOpen = false">
    <div class="flex-1 flex flex-col max-h-full min-h-400px">
      <div class="px-4 pb-4 w-full flex items-center gap-3 border-b-1 border-gray-200">
        <GeneralIcon icon="arrowLeft" class="cursor-pointer flex-none text-[20px]" @click="vOpen = false" />
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
            :disabled="!!loadingAction"
            @click="doAction(action.key)"
          >
            {{ action.label === 'Save' ? 'Save configuration' : action.label }}
          </NcButton>
        </div>
      </div>
      <div class="h-[calc(100%_-_58px)] flex py-4 flex-col">
        <div v-if="isLoading || !plugin" class="flex flex-row w-full justify-center items-center h-52">
          <a-spin size="large" />
        </div>

        <div v-else class="flex">
          <NcFormBuilder class="w-500px mx-auto" />
        </div>
      </div>
    </div>
  </NcModal>
</template>
