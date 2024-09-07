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

const isDropdownOpen = ref(false)

const integrations = ref<IntegrationType[]>([])

const availableModels = ref<string[]>([])

const getAvailableModels = async () => {
  if (!vModel.value.fk_integration_id) return

  availableModels.value = []

  try {
    const response = await $api.integrations.endpoint(vModel.value.fk_integration_id, 'availableModels', {})
    availableModels.value = response as string[]
  } catch (error) {
    console.error(error)
  }
}

onMounted(async () => {
  integrations.value = (await listIntegrationByType(IntegrationsType.Ai)) || []
})
</script>

<template>
  <NcDropdown v-model:visible="isDropdownOpen" :trigger="['click']" placement="bottomRight">
    <GeneralIcon icon="ncSettings" class="text-gray-500 cursor-pointer" />

    <template #overlay>
      <div class="flex flex-col w-[320px]">
        <div class="flex items-center w-full px-4 py-2 bg-purple-50">
          <span class="text-sm font-bold text-purple-600">Settings</span>
        </div>
        <div class="flex flex-col px-4 py-2 text-sm gap-2">
          <!-- Integration Select -->
          <div class="flex items-center gap-2">
            <span class="font-bold text-gray-600 w-2/6">Integration</span>
            <div class="w-1/6 flex justify-end">
              <GeneralIcon icon="info" class="text-sm text-gray-500" />
            </div>
            <div class="w-3/6">
              <NcSelect v-model:value="vModel.fk_integration_id" class="w-full" size="middle" @change="getAvailableModels">
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
              <GeneralIcon icon="info" class="text-sm text-gray-500" />
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
              <GeneralIcon icon="info" class="text-sm text-gray-500" />
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
