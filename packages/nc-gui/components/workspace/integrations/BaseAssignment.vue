<script setup lang="ts">
import type { IntegrationType } from 'nocodb-sdk'

interface IntegrationLinkedBaseListResponse {
  all_bases: boolean
  bases: { id: string; title: string }[]
}

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

const isLoading = ref(true)
const isSaving = ref(false)
const allBases = ref(true)
const selectedBaseIds = ref<Set<string>>(new Set())

const initialAllBases = ref(true)
const initialBaseIds = ref<Set<string>>(new Set())

const hasChanges = computed(() => {
  if (allBases.value !== initialAllBases.value) return true
  if (allBases.value) return false
  if (selectedBaseIds.value.size !== initialBaseIds.value.size) return true
  for (const id of selectedBaseIds.value) {
    if (!initialBaseIds.value.has(id)) return true
  }
  return false
})
const listRef = ref<HTMLDivElement>()
const hasScrollableContent = ref(false)

function checkScrollable() {
  if (!listRef.value) return
  const { scrollTop, scrollHeight, clientHeight } = listRef.value
  hasScrollableContent.value = scrollTop + clientHeight < scrollHeight - 4
}

const isOpen = computed({
  get: () => visible.value,
  set: (val) => emits('update:visible', val),
})

async function loadCurrentState() {
  if (!activeWorkspaceId.value || !integration.value?.id) {
    isLoading.value = false
    return
  }

  try {
    isLoading.value = true
    const result = (await $api.internal.getOperation(activeWorkspaceId.value, NO_SCOPE, {
      operation: 'integrationLinkedBaseList',
      integrationId: integration.value.id,
    })) as IntegrationLinkedBaseListResponse

    if (result.all_bases) {
      allBases.value = true
      selectedBaseIds.value = new Set()
    } else {
      allBases.value = false
      selectedBaseIds.value = new Set((result.bases || []).map((b) => b.id))
    }

    initialAllBases.value = allBases.value
    initialBaseIds.value = new Set(selectedBaseIds.value)
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

    const payload = allBases.value ? { all_bases: true } : { base_ids: Array.from(selectedBaseIds.value) }

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

watch(
  visible,
  (val) => {
    if (val) {
      loadCurrentState()
    }
  },
  { immediate: true },
)

watch(allBases, () => {
  nextTick(checkScrollable)
})
</script>

<template>
  <NcModal v-model:visible="isOpen" size="sm" wrap-class-name="nc-modal-base-assignment">
    <template #header>
      <span class="text-heading3">
        {{ t('labels.manageBaseAccess') }}
      </span>
    </template>
    <div v-if="isLoading" class="flex items-center justify-center py-8">
      <GeneralLoader />
    </div>
    <div v-else class="flex flex-col flex-1 min-h-0 overflow-hidden">
      <div
        class="flex items-center justify-between p-3 rounded-lg border-1 cursor-pointer"
        :class="allBases ? 'border-nc-border-brand bg-nc-bg-brand-soft' : 'border-nc-border-gray-medium'"
        @click="allBases = !allBases"
      >
        <div class="flex flex-col gap-1">
          <span class="text-sm font-semibold text-nc-content-gray">{{ t('activity.allBases') }}</span>
          <span class="text-bodySm text-nc-content-gray-subtle">{{ t('labels.grantAccessToAllBases') }}</span>
        </div>
        <span @click.stop>
          <NcSwitch v-model:checked="allBases" size="small" :disabled="isLoading" />
        </span>
      </div>

      <template v-if="!allBases">
        <div class="flex items-center justify-between mt-4 mb-2">
          <span class="text-captionSm text-nc-content-gray-subtle2 uppercase tracking-wide">
            {{ t('labels.selectBases') }}
          </span>
          <span class="text-bodySm text-nc-content-gray-subtle"> {{ selectedBaseIds.size }} / {{ basesList.length }} </span>
        </div>
        <div class="relative flex-1 min-h-0">
          <div ref="listRef" class="flex flex-col gap-1 h-full overflow-auto nc-scrollbar-thin" @scroll="checkScrollable">
            <div
              v-for="base in basesList"
              :key="base.id"
              class="flex items-center gap-2.5 p-2 rounded-lg hover:bg-nc-bg-gray-light cursor-pointer"
              @click="toggleBase(base.id!)"
            >
              <NcCheckbox :checked="selectedBaseIds.has(base.id!)" />
              <GeneralProjectIcon :color="parseProp(base.meta).iconColor" :type="base.type" class="h-4.5 w-4.5 flex-none" />
              <NcTooltip show-on-truncate-only class="truncate text-sm font-medium text-nc-content-gray">
                {{ base.title }}
              </NcTooltip>
            </div>
            <div v-if="!basesList.length" class="text-sm text-nc-content-gray-subtle2 py-2 text-center">
              {{ t('labels.noData') }}
            </div>
          </div>
          <div
            v-if="hasScrollableContent"
            class="absolute bottom-0 left-0 right-0 h-5 pointer-events-none"
            style="background: linear-gradient(transparent, var(--nc-bg-default))"
          />
        </div>
      </template>

      <!-- Footer -->
      <div class="flex items-center justify-end gap-2 mt-auto pt-4">
        <NcButton size="small" type="secondary" @click="isOpen = false">
          {{ $t('general.cancel') }}
        </NcButton>
        <NcButton size="small" type="primary" :loading="isSaving" :disabled="!hasChanges" @click="save">
          {{ $t('general.save') }}
        </NcButton>
      </div>
    </div>
  </NcModal>
</template>
