<script lang="ts" setup>
import type { BaseType, TableType } from 'nocodb-sdk'
import dayjs from 'dayjs'

const { activeTables } = storeToRefs(useTablesStore())
const { openTable } = useTablesStore()
const { openedProject } = storeToRefs(useProjects())

const { $e } = useNuxtApp()

const isImportModalOpen = ref(false)

const defaultBase = computed(() => {
  return openedProject.value?.bases?.[0]
})

const bases = computed(() => {
  // Convert array of bases to map of bases

  const baseMap = new Map<string, BaseType>()

  openedProject.value?.bases?.forEach((base) => {
    baseMap.set(base.id!, base)
  })

  return baseMap
})

function openTableCreateDialog(baseIndex?: number | undefined) {
  $e('c:table:create:navdraw')

  const isOpen = ref(true)
  let baseId = openedProject.value!.bases?.[0].id
  if (typeof baseIndex === 'number') {
    baseId = openedProject.value!.bases?.[baseIndex].id
  }

  const { close } = useDialog(resolveComponent('DlgTableCreate'), {
    'modelValue': isOpen,
    baseId, // || bases.value[0].id,
    'projectId': openedProject.value!.id,
    'onCreate': closeDialog,
    'onUpdate:modelValue': () => closeDialog(),
  })

  function closeDialog(table?: TableType) {
    isOpen.value = false

    if (!table) return

    // TODO: Better way to know when the table node dom is available
    setTimeout(() => {
      const newTableDom = document.querySelector(`[data-table-id="${table.id}"]`)
      if (!newTableDom) return

      // Verify that table node is not in the viewport
      if (isElementInvisible(newTableDom)) {
        // Scroll to the table node
        newTableDom?.scrollIntoView({ behavior: 'smooth' })
      }
    }, 1000)

    close(1000)
  }
}
</script>

<template>
  <div class="">
    <div class="flex flex-row gap-x-6 pb-3 pt-6">
      <div class="nc-project-view-all-table-btn" @click="openTableCreateDialog()">
        <GeneralIcon icon="addOutlineBox" />
        <div class="label">New Empty Table</div>
      </div>
      <div class="nc-project-view-all-table-btn" @click="isImportModalOpen = true">
        <GeneralIcon icon="download" />
        <div class="label">Import Data</div>
      </div>
    </div>
    <div class="flex flex-row w-full text-gray-400 border-b-1 border-gray-50 py-3 px-2.5">
      <div class="w-2/5">Table</div>
      <div class="w-1/5">Source</div>
      <div class="w-1/5">Created on</div>
    </div>
    <div
      class="nc-project-view-all-table-list nc-scrollbar-md"
      :style="{
        height: 'calc(100vh - var(--topbar-height) - 18rem)',
      }"
    >
      <div
        v-for="table in activeTables"
        :key="table.id"
        class="py-4 flex flex-row w-full cursor-pointer hover:bg-gray-50 border-b-1 border-gray-50 px-2"
        @click="openTable(table)"
      >
        <div class="flex flex-row w-2/5 items-center gap-x-2">
          <GeneralIcon icon="table" class="text-gray-700" />
          {{ table?.title }}
        </div>
        <div class="w-1/5 text-gray-600">
          <div v-if="table.base_id === defaultBase?.id" class="ml-0.75">-</div>
          <div v-else>
            <GeneralBaseLogo :base-type="bases.get(table.base_id!)?.type" class="w-4 mr-1" />
            {{ bases.get(table.base_id!)?.alias }}
          </div>
        </div>
        <div class="w-1/5 text-gray-400 ml-0.25">
          {{ dayjs(table?.created_at).fromNow() }}
        </div>
      </div>
    </div>
    <ProjectImportModal v-model:visible="isImportModalOpen" :base="defaultBase" />
  </div>
</template>

<style lang="scss" scoped>
.nc-project-view-all-table-btn {
  @apply flex flex-col gap-y-6 p-4 bg-gray-50 rounded-xl w-56 cursor-pointer text-gray-600 hover:(bg-gray-100 !text-black);

  .nc-icon {
    @apply h-10 w-10;
  }

  .label {
    @apply text-base font-medium;
  }
}
</style>
