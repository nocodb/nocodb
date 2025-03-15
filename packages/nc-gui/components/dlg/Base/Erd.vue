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
    console.error(e)
  } finally {
    isLoading.value = false
  }
})
</script>

<template>
  <GeneralModal v-model:visible="isOpen" size="large">
    <div class="flex flex-col h-[80vh]">
      <div class="flex flex-row pt-3 pb-2 px-4 justify-between items-center w-full">
        <span class="select-none text-lg font-bold"> {{ $t('title.erdView') }}: {{ base?.title }}</span>

        <a-button type="text" class="!rounded-md mr-1 -mt-1.5" @click="isOpen = false">
          <template #icon>
            <MaterialSymbolsCloseRounded data-testid="nc-root-user-invite-modal-close" class="flex mx-auto" />
          </template>
        </a-button>
      </div>

      <div class="h-full">
        <ErdView v-if="!isLoading" :source-id="activeSourceId" :base-id="baseId" :show-all-columns="false" />
      </div>
    </div>
  </GeneralModal>
</template>
