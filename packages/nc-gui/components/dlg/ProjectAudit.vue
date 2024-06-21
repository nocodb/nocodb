<script lang="ts" setup>
const props = defineProps<{
  workspaceId?: string
  baseId: string
  sourceId: string
  modelValue: boolean
  bordered?: boolean
}>()

const emit = defineEmits(['update:modelValue'])

const isOpen = useVModel(props, 'modelValue', emit)

const { workspaceId, sourceId, bordered } = toRefs(props)

const { openedProject: base } = storeToRefs(useBases())

const { baseTables } = storeToRefs(useTablesStore())
const { loadProjectTables } = useTablesStore()

const isLoading = ref(true)

const { getMeta } = useMetas()

const baseId = computed(() => props.baseId || base.value?.id)

onMounted(async () => {
  if (baseId.value && baseTables.value.get(baseId.value)) {
    return (isLoading.value = false)
  }

  try {
    await loadProjectTables(baseId.value!)

    await Promise.all(
      baseTables.value.get(baseId.value!)!.map(async (table) => {
        await getMeta(table.id!, false, false, baseId.value!)
      }),
    )
  } catch (e) {
    message.error('Failed to load tables/bases. Please try again later.')
    console.error(e)
  } finally {
    isLoading.value = false
  }
})
</script>

<template>
  <GeneralModal v-model:visible="isOpen" size="xl" class="!top-[5vh] lg:!max-w-[calc(100vw_-_64px)]" width="96.95rem">
    <div class="p-6 h-full">
      <WorkspaceAuditLogs
        v-if="!isLoading"
        :workspace-id="workspaceId"
        :source-id="sourceId"
        :base-id="baseId"
        :bordered="bordered"
      />
    </div>
  </GeneralModal>
</template>
