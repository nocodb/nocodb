<script setup lang="ts">
import dayjs from 'dayjs'

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
    ...plugin.value.formDetails.items.flatMap((item, i) => [
      {
        type: pluginTypeMap[item.type] || FormBuilderInputType.Input,
        label: item.label,
        placeholder: item.placeholder,
        model: item.key,
        required: item.required,
        helpText: item.help_text,
        width: '48',
        border: false,
        showHintAsTooltip: true,
      },
      ...(i % 2
        ? []
        : [
            {
              type: FormBuilderInputType.Space,
              width: '4',
            },
          ]),
    ]),
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

const docLinks = computed(() => {
  return [
    {
      title: 'Application Setup',
      url: `https://docs.nocodb.com/account-settings/oss-specific-details#configure-${plugin.value?.category?.toLowerCase()}`,
    },
    ...(plugin.value?.formDetails?.docs || []),
  ]
})
</script>

<template>
  <div class="flex flex-col h-full h-[calc(100vh_-_40px)]" data-testid="nc-setup-config">
    <NcPageHeader>
      <template #title>
        <div class="flex gap-3 items-center">
          <AccountSetupAppIcon :app="plugin" class="h-8 w-8" />

          <span data-rec="true">
            {{ plugin.title }}
          </span>
        </div>
      </template>
    </NcPageHeader>
    <div class="h-full flex h-[calc(100%_-_48px)]">
      <div class="nc-config-left-panel nc-scrollbar-thin relative h-full flex flex-col">
        <div class="w-full flex items-center gap-3 border-gray-200 py-6 px-6">
          <span class="font-semibold text-base">{{ $t('labels.configuration') }}</span>
          <div class="flex-grow" />

          <div class="flex gap-2">
            <NcButton
              v-for="(action, i) in plugin.formDetails.actions"
              :key="i"
              :loading="loadingAction === action.key"
              :type="action.key === Action.Save ? 'primary' : 'default'"
              size="small"
              :disabled="!!loadingAction || !isValid"
              :data-testid="`nc-setup-config-action-${action.key?.toLowerCase()}`"
              @click="doAction(action.key)"
            >
              {{ action.label }}
            </NcButton>
          </div>
        </div>
        <div class="h-[calc(100%_-_48px)] flex py-4 flex-col p-6 overflow-auto">
          <div v-if="isLoading || !plugin" class="flex flex-row w-full justify-center items-center h-52">
            <a-spin size="large" />
          </div>

          <div v-else class="flex">
            <NcFormBuilder class="w-229 px-2 mx-auto" />
          </div>
        </div>
      </div>
      <div class="nc-config-right-panel">
        <div class="flex-grow flex flex-col gap-3">
          <div class="text-gray-500 text-capitalize">{{ $t('labels.documentation') }}</div>
          <a
            v-for="doc of docLinks"
            :key="doc.title"
            :href="doc.url"
            target="_blank"
            rel="noopener noreferrer"
            class="!no-underline !text-current flex gap-2 items-center"
          >
            <GeneralIcon icon="bookOpen" class="text-gray-500" />
            {{ doc.title }}
          </a>

          <NcDivider />

          <div class="text-gray-500 text-capitalize">{{ $t('labels.modifiedOn') }}</div>
          <div class="">
            {{ dayjs(plugin.created_at).format('DD MMM YYYY HH:mm') }}
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
