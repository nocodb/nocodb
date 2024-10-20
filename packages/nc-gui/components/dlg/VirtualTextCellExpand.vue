//custom component for expanding virtual cell

<script lang="ts" setup>
import type { ColumnType } from 'ant-design-vue/lib/table';

/// isVisible - for changing the model visible state as start expand trigger placed in parent
/// onCLose to handle close action and change visible bool in parent

const props = defineProps<{
  modelValue?: string | number,
  isVisible: Boolean,
  onClose: Function 


}>()

const column = inject(ColumnInj) as Ref<ColumnType & { colOptions: { error: any } }>

const inputWrapperRef = ref<HTMLElement | null>(null)


///// handle dragging
const isDragging = ref(false)
const mousePosition = ref<
  | {
      top: number
      left: number
    }
  | undefined
  >()

const position = ref<
  | {
      top: number
      left: number
    }
  | undefined
    >()

const dragStart = (e: MouseEvent) => {

const dom = document.querySelector('.nc-long-text-expanded-modal .ant-modal-content') as HTMLElement

  mousePosition.value = {
    top: e.clientY - dom.getBoundingClientRect().top,
    left: e.clientX - dom.getBoundingClientRect().left + 16,
  }

  document.addEventListener('mousemove', onMouseMove)
  document.addEventListener('mouseup', onMouseUp)

  isDragging.value = true
}

const onMouseMove = (e: MouseEvent) => {
  if (!isDragging.value) return

  e.stopPropagation()

  position.value = {
    top: e.clientY - (mousePosition.value?.top || 0) > 0 ? e.clientY - (mousePosition.value?.top || 0) : position.value?.top || 0,
    left:
      e.clientX - (mousePosition.value?.left || 0) > -16
        ? e.clientX - (mousePosition.value?.left || 0)
        : position.value?.left || 0,
  }
}



const onMouseUp = (e: MouseEvent) => {
  if (!isDragging.value) return

  e.stopPropagation()

  isDragging.value = false
  position.value = undefined
  mousePosition.value = undefined

  document.removeEventListener('mousemove', onMouseMove)
  document.removeEventListener('mouseup', onMouseUp)
}

onClickOutside(inputWrapperRef, (e) => {
  if ((e.target as HTMLElement)?.className.includes('nc-long-text-toggle-expand')) return

  if (props.onClose) {
    props.onClose() // Call the void callback when closing the modal
  }
})

const stopPropagation = (event: MouseEvent) => {
  event.stopPropagation()
}

watch(inputWrapperRef, () => {

  // stop event propogation in edit column
  const modal = document.querySelector('.nc-long-text-expanded-modal') as HTMLElement

  if ( props.isVisible && modal?.parentElement) {
    modal.parentElement.addEventListener('click', stopPropagation)
    modal.parentElement.addEventListener('mousedown', stopPropagation)
    modal.parentElement.addEventListener('mouseup', stopPropagation)
  } else if (modal?.parentElement) {
    modal.parentElement.removeEventListener('click', stopPropagation)
    modal.parentElement.removeEventListener('mousedown', stopPropagation)
    modal.parentElement.removeEventListener('mouseup', stopPropagation)
  }
})

</script>

<template>
    <a-modal v-if="props.isVisible" v-model:visible="props.isVisible" :closable="false" :footer="null"
        wrap-class-name="nc-long-text-expanded-modal" :mask="true" :mask-closable="false" :mask-style="{ zIndex: 1051 }"
        :z-index="1052">
        <div ref="inputWrapperRef" class="flex flex-col py-3 w-full expanded-cell-input relative" :class="{
          'cursor-move': isDragging,
        }" @keydown.enter.stop>
            <div v-if="column"
                class="flex flex-row gap-x-1 items-center font-medium pl-3 pb-2.5 border-b-1 border-gray-100 overflow-hidden"
                :class="{
            'select-none': isDragging,
            
          }" @mousedown="dragStart">
                <SmartsheetHeaderVirtualCellIcon class="flex" />
                <div class="flex max-w-38">
                    <span class="truncate">
                        {{ column.title }}
                    </span>
                </div>
            </div>
            <div v-if="!false" class="p-3 pb-0 h-full">
                <a-textarea ref="inputRef" v-model:value="props.modelValue"
                    class="nc-text-area-expanded !py-1 !px-3 !text-black !cursor-text !min-h-[210px] !rounded-lg focus:border-brand-500 disabled:!bg-gray-50 nc-longtext-scrollbar"
                    :placeholder="$t('activity.enterText')" :style="{ resize: 'both' }" :disabled="true"
                    @keydown.escape="props.onClose()" @keydown.alt.stop />
            </div>

            <LazyCellClampedText v-else :value="props.modelValue" />
        </div>
    </a-modal>
    
</template>
<style lang="scss" scoped>

.nc-text-area-expanded {
  @apply h-[min(795px,100vh_-_170px)] w-[min(1256px,100vw_-_124px)];

  max-height: min(795px, 100vh - 170px);
  min-width: 256px;
  max-width: min(1256px, 100vw - 126px);
  scrollbar-width: thin !important;
  &::-webkit-scrollbar-thumb {
    @apply rounded-lg;
  }
}
.nc-longtext-scrollbar {
  @apply scrollbar-thin scrollbar-thumb-gray-200 hover:scrollbar-thumb-gray-300 scrollbar-track-transparent;
}


</style>

<style lang="scss">


.nc-long-text-expanded-modal {
  .ant-modal {
    @apply !w-full h-full !top-0 !mx-auto !my-0;

    .ant-modal-content {
      @apply absolute w-[fit-content] min-h-70 min-w-70 !p-0 left-[50%] top-[50%];

      /* Use 'transform' to center the div correctly */
      transform: translate(-50%, -50%);

      max-width: min(1280px, 100vw - 100px);
      max-height: min(864px, 100vh - 100px);

      .nc-longtext-scrollbar {
        @apply scrollbar-thin scrollbar-thumb-gray-200 hover:scrollbar-thumb-gray-300 scrollbar-track-transparent;
      }
    }
  }
}
</style>