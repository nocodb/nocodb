<script setup lang="ts">
import { useSyncFormOrThrow } from '../useSyncForm'

interface Props {
  index: number
}

const props = defineProps<Props>()

const { $api } = useNuxtApp()

const { getIntegrationForm } = useIntegrationStore()

const {
  integrationConfigs,
  availableIntegrations,
  updateIntegrationConfig,
  integrationConfigValidationCallbacks,
  removeIntegrationConfig,
} = useSyncFormOrThrow()

const { activeWorkspaceId } = storeToRefs(useWorkspace())

const { activeProjectId } = storeToRefs(useBases())

const index = toRef(props, 'index')

const isExpanded = ref(true)

const config = computed(() => {
  return integrationConfigs.value[index.value] || {}
})

const subType = computed({
  get() {
    return config.value.sub_type
  },
  set(value) {
    updateIntegrationConfig(index.value, {
      ...config.value,
      sub_type: value,
    })
  },
})

const formSchema = computedAsync(() => {
  return getIntegrationForm(IntegrationCategoryType.SYNC, subType.value)
})

const { formState, validate } = useProvideFormBuilderHelper({
  formSchema,
  initialState: config,
  fetchOptions: async (key: string) => {
    const wsId = unref(activeWorkspaceId)
    const bsId = unref(activeProjectId)

    if (!key || !wsId || !bsId) return []

    return await $api.internal.postOperation(
      wsId,
      bsId,
      {
        operation: 'syncIntegrationFetchOptions',
      },
      {
        integration: formState.value,
        key,
      },
    )
  },
  onChange: () => {
    updateIntegrationConfig(index.value, formState.value)
  },
})

onMounted(async () => {
  await waitForCondition(() => !!formSchema.value)
  integrationConfigValidationCallbacks.value[index.value] = validate
})

onBeforeUnmount(() => {
  delete integrationConfigValidationCallbacks.value[index.value]
})
</script>

<template>
  <div>
    <div
      class="flex gap-2.5 cursor-pointer hover:bg-nc-bg-gray-extralight py-2 px-3 rounded-lg"
      @click="isExpanded = !isExpanded"
    >
      <div class="text-nc-content-gray text-bodyBold flex-1 truncate">
        <NcTooltip class="truncate" show-on-truncate-only>
          {{ formState.title }}
          <template #title>
            {{ formState.title }}
          </template>
        </NcTooltip>
      </div>

      <NcButton type="text" size="xxsmall" @click.stop="removeIntegrationConfig(index)">
        <GeneralIcon icon="delete" />
      </NcButton>

      <NcButton type="text" size="xxsmall">
        <GeneralIcon
          class="h-4 w-4 transition-all transform"
          :class="{
            'rotate-180': isExpanded,
          }"
          icon="ncChevronDown"
        />
      </NcButton>
    </div>
    <div v-show="isExpanded" class="px-3 my-4">
      <a-form-item label="Sync Source" class="w-full">
        <a-select v-model:value="subType" class="nc-select-shadow">
          <template #suffixIcon>
            <GeneralIcon class="text-nc-content-gray-muted" icon="ncChevronDown" />
          </template>
          <a-select-option v-for="integration in availableIntegrations" :key="integration.title" :value="integration.sub_type">
            <div class="w-full flex gap-2 items-center">
              <GeneralIntegrationIcon v-if="integration?.sub_type" :type="integration.sub_type" />
              <NcTooltip show-on-truncate-only class="flex-1 truncate">
                <template #title>
                  {{ integration.title }}
                </template>
                {{ integration.title }}
              </NcTooltip>
              <GeneralIcon
                v-if="subType === integration.sub_type"
                id="nc-selected-item-icon"
                class="text-primary w-4 h-4"
                icon="check"
              />
            </div>
          </a-select-option>
        </a-select>
      </a-form-item>

      <NcFormBuilder :key="`${index}-${subType}`" class="nc-config-section" />
    </div>
  </div>
</template>
