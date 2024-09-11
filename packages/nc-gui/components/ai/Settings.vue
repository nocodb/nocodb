<script lang="ts" setup>
import { type IntegrationType, IntegrationsType } from 'nocodb-sdk'

const props = defineProps<{
  settings: Record<string, any>
  workspaceId: string
  scope?: string
}>()

const vModel = useVModel(props, 'settings', undefined, {
  defaultValue: {},
})

const { $api } = useNuxtApp()

const { listIntegrationByType } = useIntegrationStore()

const lastIntegrationId = ref<string | null>(null)

const isDropdownOpen = ref(false)

const integrations = ref<IntegrationType[]>([])

const availableModels = ref<string[]>([])

const onIntegrationChange = async () => {
  if (!vModel.value.fk_integration_id) return

  availableModels.value = []

  if (lastIntegrationId.value !== vModel.value.fk_integration_id) {
    vModel.value.model = null
  }

  try {
    const response = await $api.integrations.endpoint(vModel.value.fk_integration_id, 'availableModels', {})
    availableModels.value = response as string[]
  } catch (error) {
    console.error(error)
  }
}

onMounted(async () => {
  integrations.value = (await listIntegrationByType(IntegrationsType.Ai)) || []

  if (!vModel.value.fk_integration_id) {
    if (integrations.value.length > 0) {
      vModel.value.fk_integration_id = integrations.value[0].id

      if (!vModel.value.model) {
        await onIntegrationChange()
        if (availableModels.value.length > 0) {
          vModel.value.model = availableModels.value[0]
        }
      }
    }
  } else {
    lastIntegrationId.value = vModel.value.fk_integration_id
  }

  if (!vModel.value.randomness) {
    vModel.value.randomness = 'low'
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
              <NcSelect v-model:value="vModel.fk_integration_id" class="w-full" size="middle" @change="onIntegrationChange">
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
                v-model:value="vModel.model"
                class="w-full"
                size="middle"
                :disabled="!vModel.fk_integration_id"
                :loading="vModel.fk_integration_id && availableModels.length === 0"
              >
                <a-select-option v-for="model in availableModels" :key="model" :value="model">
                  {{ model }}
                </a-select-option>
              </NcSelect>
            </div>
          </div>
          <!-- Randomness -->
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
        </div>
      </div>
    </template>
  </NcDropdown>
</template>

<style lang="scss" scoped></style>
