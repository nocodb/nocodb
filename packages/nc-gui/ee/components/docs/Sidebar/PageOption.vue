<script setup lang="ts">
import { onClickOutside, onKeyStroke } from '@vueuse/core'

const props = defineProps<{
  level: number
}>()

const emit = defineEmits(['openDeleteModal', 'updateSelectedPageId', 'addNewPage'])

const MAX_NESTED_LEVEL = 5

const { level } = props

const { isEditAllowed } = storeToRefs(useDocStore())

const isOptionOpen = ref(false)
const optionDomRef = ref<HTMLElement>()

onClickOutside(optionDomRef, () => (isOptionOpen.value = false))

onKeyStroke(
  'Escape',
  () => {
    if (!isOptionOpen.value) return

    isOptionOpen.value = false
  },
  { passive: true },
)

const openDeleteModal = () => {
  isOptionOpen.value = false

  emit('updateSelectedPageId')

  emit('openDeleteModal')
}

const addNewPage = () => {
  emit('addNewPage')
}
</script>

<template>
  <div v-if="isEditAllowed" class="flex flex-row justify-start items-center gap-x-1 h-3">
    <a-dropdown v-model:visible="isOptionOpen" placement="bottom" trigger="click">
      <div
        class="nc-docs-sidebar-page-options px-0.5 hover:(!bg-gray-300 !bg-opacity-30 rounded-md) cursor-pointer select-none"
        data-testid="docs-sidebar-page-options"
        :class="{
          'hidden group-hover:block': !isOptionOpen,
        }"
      >
        <MdiDotsHorizontal />
      </div>
      <template #overlay>
        <div ref="optionDomRef" class="flex flex-col p-1 bg-white rounded-md w-28 gap-y-0.5 border-1 border-gray-100">
          <div
            class="flex items-center cursor-pointer select-none px-2 py-1.5 text-xs gap-x-2.5 hover:bg-gray-50 rounded-md !text-red-500"
            data-testid="docs-sidebar-page-delete"
            @click="openDeleteModal"
          >
            <MdiDeleteOutline class="h-3.5" />
            <div class="flex font-semibold">Delete</div>
          </div>
        </div>
      </template>
    </a-dropdown>
    <div
      v-if="level < MAX_NESTED_LEVEL"
      class="nc-docs-add-child-page px-0.5 hover:( !bg-gray-300 !bg-opacity-30 rounded-md) cursor-pointer select-none"
      :class="{
        'hidden group-hover:block': !isOptionOpen,
      }"
      @click="addNewPage"
    >
      <MdiPlus />
    </div>
  </div>
</template>
