<script lang="ts" setup>
import { type IntegrationType, IntegrationsType } from 'nocodb-sdk'

const props = defineProps<{
  fkIntegrationId: string
  model?: string
  randomness?: string
  workspaceId: string
  scope?: string
}>()

const emits = defineEmits(['update:fkIntegrationId', 'update:model', 'update:randomness'])

const vFkIntegrationId = useVModel(props, 'fkIntegrationId', emits)

const vModel = useVModel(props, 'model', emits)

// const vRandomness = useVModel(props, 'randomness', emits)

const { $api } = useNuxtApp()

const { listIntegrationByType } = useIntegrationStore()

const lastIntegrationId = ref<string | null>(null)

const isDropdownOpen = ref(false)

const integrations = ref<IntegrationType[]>([])

const availableModels = ref<string[]>([])

const onIntegrationChange = async () => {
  if (!vFkIntegrationId.value) return

  availableModels.value = []

  if (lastIntegrationId.value !== vFkIntegrationId.value) {
    vModel.value = undefined
  }

  try {
    const response = await $api.integrations.endpoint(vFkIntegrationId.value, 'availableModels', {})
    availableModels.value = response as string[]

    if (!vModel.value && availableModels.value.length > 0) {
      vModel.value = availableModels.value[0]
    }
  } catch (error) {
    console.error(error)
  }
}

onMounted(async () => {
  integrations.value = (await listIntegrationByType(IntegrationsType.Ai)) || []

  if (!vFkIntegrationId.value) {
    if (integrations.value.length > 0 && integrations.value[0].id) {
      vFkIntegrationId.value = integrations.value[0].id
      nextTick(() => {
        onIntegrationChange()
      })
    }
  } else {
    lastIntegrationId.value = vFkIntegrationId.value
  }
})
</script>

<template>
  <NcDropdown v-model:visible="isDropdownOpen" :trigger="['click']" placement="bottomRight">
    <slot>
      <GeneralIcon icon="ncSettings" class="text-gray-500 cursor-pointer" />
    </slot>

    <template #overlay>
      <div class="flex flex-col w-[320px] overflow-hidden">
        <div class="flex items-center w-full px-4 py-2 bg-purple-50">
          <span class="text-sm font-bold text-purple-600">Settings</span>
        </div>
        <div class="flex flex-col px-4 py-2 text-sm gap-2">
          <!-- Integration Select -->
          <div class="flex items-center gap-2">
            <span class="font-bold text-gray-600 w-2/6">Integration</span>
            <div class="w-1/6 flex justify-end">
              <NcTooltip placement="top">
                <template #title>
                  <span>Integration to use for this operation</span>
                </template>
                <GeneralIcon icon="info" class="text-sm text-gray-500" />
              </NcTooltip>
            </div>
            <div class="w-3/6">
              <NcSelect v-model:value="vFkIntegrationId" class="w-full" size="middle" @change="onIntegrationChange">
                <a-select-option v-for="integration in integrations" :key="integration.id" :value="integration.id">
                  {{ integration.title }}
                </a-select-option>
              </NcSelect>
            </div>
          </div>
          <!-- Model Select -->
          <div class="flex items-center gap-2">
            <span class="font-bold text-gray-600 w-2/6">Model</span>
            <div class="w-1/6 flex justify-end">
              <NcTooltip placement="top">
                <template #title>
                  <span>Model to use for this operation</span>
                </template>
                <GeneralIcon icon="info" class="text-sm text-gray-500" />
              </NcTooltip>
            </div>
            <div class="w-3/6">
              <NcSelect
                v-model:value="vModel"
                class="w-full"
                size="middle"
                :disabled="!vFkIntegrationId"
                :loading="vFkIntegrationId.length > 0 && availableModels.length === 0"
              >
                <a-select-option v-for="md in availableModels" :key="md" :value="md">
                  {{ md }}
                </a-select-option>
              </NcSelect>
            </div>
          </div>
          <!-- Randomness 
          <div class="flex items-center gap-2">
            <span class="font-bold text-gray-600 w-2/6">Randomness</span>
            <div class="w-1/6 flex justify-end">
              <NcTooltip placement="top">
                <template #title>
                  <span>Randomness of the response</span>
                </template>
                <GeneralIcon icon="info" class="text-sm text-gray-500" />
              </NcTooltip>
            </div>
            <div class="w-3/6">
              <NcSelect v-model:value="vModel.randomness" class="w-full" size="middle" :disabled="!vModel.fk_integration_id">
                <a-select-option value="high">High</a-select-option>
                <a-select-option value="medium">Medium</a-select-option>
                <a-select-option value="low">Low (Default)</a-select-option>
              </NcSelect>
            </div>
          </div>
          -->
        </div>
      </div>
    </template>
  </NcDropdown>
</template>

<style lang="scss" scoped></style>
