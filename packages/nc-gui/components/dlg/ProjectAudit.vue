<script lang="ts" setup>
const props = defineProps<{
  baseId: string
  sourceId: string
  modelValue: boolean
}>()

const emit = defineEmits(['update:modelValue'])

const isOpen = useVModel(props, 'modelValue', emit)

const activeSourceId = computed(() => props.sourceId)

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
  <GeneralModal v-model:visible="isOpen" size="xl" class="!w-[70rem] !top-[5vh]">
    <div class="p-6 h-full">
      <DashboardSettingsBaseAudit v-if="!isLoading" :source-id="activeSourceId" :base-id="baseId" :show-all-columns="false" />
    </div>
  </GeneralModal>
</template>
