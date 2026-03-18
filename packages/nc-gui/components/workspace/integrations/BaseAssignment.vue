<script setup lang="ts">
import type { IntegrationType } from 'nocodb-sdk'

interface Props {
  visible: boolean
  integration: IntegrationType
}

const props = withDefaults(defineProps<Props>(), {})

const emits = defineEmits<{
  'update:visible': [value: boolean]
  'updated': []
}>()

const { visible, integration } = toRefs(props)

const { $api } = useNuxtApp()

const { t } = useI18n()

const workspaceStore = useWorkspace()
const { activeWorkspaceId } = storeToRefs(workspaceStore)

const basesStore = useBases()
const { basesList } = storeToRefs(basesStore)

const isLoading = ref(false)
const isSaving = ref(false)
const allBases = ref(true)
const selectedBaseIds = ref<Set<string>>(new Set())

const isOpen = computed({
  get: () => visible.value,
  set: (val) => emits('update:visible', val),
})

async function loadCurrentState() {
  if (!activeWorkspaceId.value || !integration.value?.id) return

  try {
    isLoading.value = true
    const result = (await $api.internal.getOperation(activeWorkspaceId.value, NO_SCOPE, {
      operation: 'integrationLinkedBaseList',
      integrationId: integration.value.id,
    })) as any

    if (result?.all_bases) {
      allBases.value = true
      selectedBaseIds.value = new Set()
    } else {
      allBases.value = false
      selectedBaseIds.value = new Set((result?.bases || []).map((b: any) => b.id))
    }
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
  } finally {
    isLoading.value = false
  }
}

async function save() {
  if (!activeWorkspaceId.value || !integration.value?.id) return

  try {
    isSaving.value = true

    const payload = allBases.value
      ? { all_bases: true }
      : { base_ids: Array.from(selectedBaseIds.value) }

    await $api.internal.postOperation(
      activeWorkspaceId.value,
      NO_SCOPE,
      { operation: 'integrationUpdateLinkedBases', integrationId: integration.value.id },
      payload,
    )

    message.success(t('msg.success.updated'))
    emits('updated')
    isOpen.value = false
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
  } finally {
    isSaving.value = false
  }
}

function toggleBase(baseId: string) {
  if (selectedBaseIds.value.has(baseId)) {
    selectedBaseIds.value.delete(baseId)
  } else {
    selectedBaseIds.value.add(baseId)
  }
  selectedBaseIds.value = new Set(selectedBaseIds.value)
}

watch(visible, (val) => {
  if (val) {
    loadCurrentState()
  }
})
</script>

<template>
  <NcModal v-model:visible="isOpen" size="sm" :body-style="{ padding: 0 }">
    <div class="flex flex-col">
      <!-- Header -->
      <div class="flex items-center justify-between p-4 border-b-1 border-nc-border-gray-medium">
        <h3 class="text-sm font-semibold text-nc-content-gray m-0">
          {{ t('labels.manageBaseAccess') }}
        </h3>
        <NcButton size="xs" type="text" @click="isOpen = false">
          <GeneralIcon icon="close" />
        </NcButton>
      </div>

      <div v-if="isLoading" class="flex items-center justify-center py-12">
        <GeneralLoader />
      </div>

      <template v-else>
        <!-- Toggle -->
        <div class="flex flex-col gap-3 p-4">
          <div class="flex items-center gap-2">
            <NcSwitch v-model:checked="allBases" size="small" />
            <span class="text-sm text-nc-content-gray">{{ t('activity.allBases') }}</span>
          </div>

          <!-- Base list (when specific bases selected) -->
          <div v-if="!allBases" class="flex flex-col gap-1 max-h-64 overflow-auto nc-scrollbar-thin">
            <div
              v-for="base in basesList"
              :key="base.id"
              class="flex items-center gap-2 p-2 rounded-md hover:bg-nc-bg-gray-light cursor-pointer"
              @click="toggleBase(base.id!)"
            >
              <NcCheckbox :checked="selectedBaseIds.has(base.id!)" />
              <GeneralProjectIcon
                :color="parseProp(base.meta).iconColor"
                :type="base.type"
                class="h-4 w-4 flex-none"
              />
              <NcTooltip show-on-truncate-only class="truncate text-sm text-nc-content-gray">
                {{ base.title }}
              </NcTooltip>
            </div>
            <div v-if="!basesList.length" class="text-sm text-nc-content-gray-subtle2 py-2 text-center">
              {{ t('labels.noData') }}
            </div>
          </div>
        </div>

        <!-- Footer -->
        <div class="flex items-center justify-end gap-2 p-4 border-t-1 border-nc-border-gray-medium">
          <NcButton size="small" type="secondary" @click="isOpen = false">
            {{ $t('general.cancel') }}
          </NcButton>
          <NcButton size="small" type="primary" :loading="isSaving" @click="save">
            {{ $t('general.save') }}
          </NcButton>
        </div>
      </template>
    </div>
  </NcModal>
</template>
