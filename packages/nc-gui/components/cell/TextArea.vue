<script setup lang="ts">
import type { AIRecordType } from 'nocodb-sdk'
import { NcMarkdownParser } from '~/helpers/tiptap'

const props = defineProps<{
  modelValue?: string | number
  isFocus?: boolean
  virtual?: boolean
  isAi?: boolean
  aiMeta?: AIRecordType
  isAiEdited?: boolean
  isFieldAiIntegrationAvailable?: boolean
}>()

const emits = defineEmits(['update:modelValue', 'update:isAiEdited', 'generate', 'close'])

const meta = inject(MetaInj, ref())

const column = inject(ColumnInj)

const editEnabled = inject(EditModeInj, ref(false))

const isEditColumn = inject(EditColumnInj, ref(false))

const rowHeight = inject(RowHeightInj, ref(1 as const))

const isForm = inject(IsFormInj, ref(false))

const isGrid = inject(IsGridInj, ref(false))

const isGallery = inject(IsGalleryInj, ref(false))

const isKanban = inject(IsKanbanInj, ref(false))

const readOnly = inject(ReadonlyInj, ref(false))

const isCanvasInjected = inject(IsCanvasInjectionInj, false)
const clientMousePosition = inject(ClientMousePositionInj)
const isUnderLookup = inject(IsUnderLookupInj, ref(false))
const canvasSelectCell = inject(CanvasSelectCellInj)

const { showNull, user } = useGlobal()

const { currentRow } = useSmartsheetRowStoreOrThrow()

const { aiLoading, aiIntegrations, generatingRows, generatingColumnRows } = useNocoAi()

const baseStore = useBase()

const { idUserMap } = storeToRefs(baseStore)

const basesStore = useBases()

const { basesUser } = storeToRefs(basesStore)

const baseUsers = computed(() => (meta.value?.base_id ? basesUser.value.get(meta.value.base_id) || [] : []))

const vModel = useVModel(props, 'modelValue', emits, {
  shouldEmit: () => !readOnly.value,
})

const isAiEdited = useVModel(props, 'isAiEdited', emits)

const isExpandedFormOpen = inject(IsExpandedFormOpenInj, ref(false))!

const textAreaRef = ref<HTMLTextAreaElement>()

const position = ref<
  | {
      top: number
      left: number
    }
  | undefined
>()

const mousePosition = ref<
  | {
      top: number
      left: number
    }
  | undefined
>()

const isDragging = ref(false)

const height = computed(() => {
  if (isExpandedFormOpen.value) return 36 * 4

  if (!rowHeight.value || rowHeight.value === 1 || isEditColumn.value) return 36

  return rowHeight.value * 36
})

const localRowHeight = computed(() => {
  if (readOnly.value && !isExpandedFormOpen.value && (isGallery.value || isKanban.value)) return 6

  return rowHeight.value
})

const isVisible = ref(false)

const inputWrapperRef = ref<HTMLElement | null>(null)

const inputRef = ref<HTMLTextAreaElement | null>(null)

const aiWarningRef = ref<HTMLDivElement>()

const { height: aiWarningRefHeight } = useElementSize(aiWarningRef)

const rowId = computed(() => {
  return extractPkFromRow(currentRow.value?.row, meta.value!.columns!)
})

const isAiGenerating = computed(() => {
  return !!(
    rowId.value &&
    column?.value.id &&
    generatingRows.value.includes(rowId.value) &&
    generatingColumnRows.value.includes(column.value.id)
  )
})

watch(isVisible, (newVal, oldVal) => {
  if (isVisible.value) {
    setTimeout(() => {
      inputRef.value?.focus()
    }, 100)
  }
  if (oldVal && !newVal) canvasSelectCell?.trigger()
})

onClickOutside(inputWrapperRef, (e) => {
  if ((e.target as HTMLElement)?.className.includes('nc-long-text-toggle-expand')) return

  const targetEl = e?.target as HTMLElement

  if (
    targetEl?.closest(
      '.bubble-menu, .tippy-content, .nc-textarea-rich-editor, .tippy-box, .mention, .nc-mention-list, .tippy-content',
    )
  ) {
    return
  }

  emits('close')
  isVisible.value = false
})

const onTextClick = () => {
  if (!props.virtual) return

  isVisible.value = true
  editEnabled.value = true
}

const isRichMode = computed(() => {
  let meta: any = {}
  if (typeof column?.value?.meta === 'string') {
    meta = JSON.parse(column?.value?.meta)
  } else {
    meta = column?.value?.meta ?? {}
  }

  return meta?.richMode
})

const richTextContent = computedAsync(async () => {
  if (isRichMode.value && vModel.value) {
    return Promise.resolve(
      NcMarkdownParser.parse(
        unref(vModel.value),
        {
          enableMention: true,
          users: unref(baseUsers.value),
          currentUser: unref(user.value),
          ...(isExpandedFormOpen.value ? { maxBlockTokens: undefined } : { maxBlockTokens: rowHeight.value }),
        },
        true,
      ),
    )
  }
  return Promise.resolve('')
})

const onExpand = () => {
  isVisible.value = true
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

watch(
  position,
  () => {
    const dom = document.querySelector('.nc-long-text-expanded-modal .ant-modal-content') as HTMLElement
    if (!dom || !position.value) return

    // Set left and top of dom
    dom.style.transform = 'none'
    dom.style.left = `${position.value.left}px`
    dom.style.top = `${position.value.top}px`
  },
  { deep: true },
)

const dragStart = (e: MouseEvent) => {
  if (isEditColumn.value) return

  const dom = document.querySelector('.nc-long-text-expanded-modal .ant-modal-content') as HTMLElement

  mousePosition.value = {
    top: e.clientY - dom.getBoundingClientRect().top,
    left: e.clientX - dom.getBoundingClientRect().left + 16,
  }

  document.addEventListener('mousemove', onMouseMove)
  document.addEventListener('mouseup', onMouseUp)

  isDragging.value = true
}

const generate = () => {
  emits('generate')
}

if (props.isAi) {
  watch(vModel, (_o, _n) => {
    isAiEdited.value = true
  })
}

watch(editEnabled, () => {
  if (editEnabled.value && (isRichMode.value || props.isAi)) {
    isVisible.value = true
  }
})

const stopPropagation = (event: MouseEvent) => {
  event.stopPropagation()
}

watch(inputWrapperRef, () => {
  if (!isEditColumn.value) return

  // stop event propogation in edit column
  const modal = document.querySelector('.nc-long-text-expanded-modal') as HTMLElement

  if (isVisible.value && modal?.parentElement) {
    modal.parentElement.addEventListener('click', stopPropagation)
    modal.parentElement.addEventListener('mousedown', stopPropagation)
    modal.parentElement.addEventListener('mouseup', stopPropagation)
  } else if (modal?.parentElement) {
    modal.parentElement.removeEventListener('click', stopPropagation)
    modal.parentElement.removeEventListener('mousedown', stopPropagation)
    modal.parentElement.removeEventListener('mouseup', stopPropagation)
  }
})

const handleClose = () => {
  isVisible.value = false
}

const STORAGE_KEY = 'nc-long-text-expanded-modal-size'

const { width: widthTextArea, height: heightTextArea } = useElementSize(inputRef)

watch([widthTextArea, heightTextArea], () => {
  if (isVisible.value) {
    const size = {
      width: widthTextArea.value,
      height: heightTextArea.value,
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(size))
  }
})

const updateSize = () => {
  try {
    const size = localStorage.getItem(STORAGE_KEY)
    let elem = document.querySelector('.nc-text-area-expanded') as HTMLElement

    if (isRichMode.value) {
      elem = document.querySelector('.nc-long-text-expanded-modal .nc-textarea-rich-editor .tiptap') as HTMLElement
    }

    const parsedJSON = JSON.parse(size)

    if (parsedJSON && elem) {
      elem.style.width = `${parsedJSON.width}px`
      elem.style.height = `${parsedJSON.height}px`
    }
  } catch (e) {
    console.error(e)
  }
}

watch(
  [isVisible, inputRef],
  (value) => {
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect

        if (!isVisible.value) {
          return
        }

        localStorage.setItem(STORAGE_KEY, JSON.stringify({ width, height }))
      }
    })

    if (value) {
      if (isRichMode.value && isVisible.value) {
        setTimeout(() => {
          const el = document.querySelector('.nc-long-text-expanded-modal .nc-textarea-rich-editor .tiptap') as HTMLElement

          if (!el) return

          observer.observe(el)

          updateSize()
        }, 50)
      } else {
        updateSize()
      }
    } else {
      observer.disconnect()
    }
  },
  {
    immediate: true,
  },
)

watch(textAreaRef, (el) => {
  if (el && !isExpandedFormOpen.value && !isEditColumn.value && !isForm.value) {
    el.focus()
  }
})

onMounted(() => {
  if (isUnderLookup.value || !isCanvasInjected || !clientMousePosition || isExpandedFormOpen.value) return
  const position = { clientX: clientMousePosition.clientX, clientY: clientMousePosition.clientY + 2 }
  forcedNextTick(() => {
    if (getElementAtMouse('.nc-canvas-table-editable-cell-wrapper .nc-textarea-expand', position)) {
      onExpand()
    } else if (getElementAtMouse('.nc-canvas-table-editable-cell-wrapper .nc-textarea-generate', position)) {
      generate()
    } else if (isRichMode.value || props.isAi) {
      onExpand()
    }
  })
})
</script>

<template>
  <div
    :class="{
      'nc-expanded-form-open': isExpandedFormOpen,
    }"
  >
    <div
      class="flex flex-row w-full long-text-wrapper items-center"
      :class="{
        'min-h-10': rowHeight !== 1 || isExpandedFormOpen,
        'min-h-5.5': rowHeight === 1 && !isExpandedFormOpen,
        'h-full w-full': isForm,
      }"
    >
      <div v-if="isForm && isRichMode" class="w-full">
        <div
          class="w-full relative w-full px-0"
          :class="{
            'pt-11': !readOnly,
          }"
        >
          <LazyCellRichText
            v-model:value="vModel"
            :class="{
              'border-t-1 border-gray-100 allow-vertical-resize': !readOnly,
            }"
            :autofocus="false"
            show-menu
            :read-only="readOnly"
          />
        </div>
      </div>

      <div
        v-else-if="isRichMode"
        class="w-full cursor-pointer nc-readonly-rich-text-wrapper"
        :class="[
          isExpandedFormOpen ? 'nc-scrollbar-thin' : 'overflow-hidden',
          {
            'nc-readonly-rich-text-grid ': !isExpandedFormOpen && !isForm,
            'nc-readonly-rich-text-sort-height': localRowHeight === 1 && !isExpandedFormOpen && !isForm,
          },
        ]"
        :style="{
          maxHeight: isForm
            ? undefined
            : isExpandedFormOpen
            ? `${height}px`
            : `${16.6 * rowHeightTruncateLines(localRowHeight)}px`,
          minHeight: isForm
            ? undefined
            : isExpandedFormOpen
            ? `${height}px`
            : `${16.5 * rowHeightTruncateLines(localRowHeight)}px`,
        }"
        @dblclick="onExpand"
        @keydown.enter="onExpand"
      >
        <div
          class="nc-cell-field nc-rich-text-content nc-rich-text-content-grid"
          :class="!isExpandedFormOpen ? `line-clamp-${rowHeightTruncateLines(localRowHeight, true)}` : 'py-2'"
          v-html="richTextContent"
        ></div>
      </div>
      <!-- eslint-disable vue/use-v-on-exact -->
      <div
        v-else-if="(editEnabled && !isVisible) || isForm"
        class="h-full w-full"
        :class="{
          'my-1 bg-nc-bg-purple-light rounded-lg': props.isAi && isExpandedFormOpen && !readOnly,
        }"
      >
        <textarea
          ref="textAreaRef"
          v-model="vModel"
          :rows="isForm ? 5 : 4"
          class="h-full w-full !outline-none nc-scrollbar-thin"
          :class="{
            'p-2': editEnabled,
            'py-1 h-full': isForm,
            'px-2': isExpandedFormOpen,
            'border-none': !(props.isAi && isExpandedFormOpen),
            'border-1 border-nc-border-gray-medium rounded-lg !focus:(shadow-selected border-primary ring-0) transition-shadow duration-300':
              props.isAi && isExpandedFormOpen,
          }"
          :style="{
            minHeight: isForm ? '117px' : `${height}px`,
            maxHeight: 'min(800px, calc(100vh - 200px))',
          }"
          :disabled="readOnly || (props.isAi && isEditColumn)"
          @blur="editEnabled = false"
          @keydown.alt.stop
          @keydown.alt.enter.stop
          @keydown.shift.enter.stop
          @keydown.down.stop
          @keydown.left.stop
          @keydown.right.stop
          @keydown.up.stop
          @keydown.delete.stop
          @selectstart.capture.stop
          @mousedown.stop
        />
        <div v-if="!readOnly && props.isAi && isExpandedFormOpen" class="-mt-1">
          <div v-if="props.aiMeta?.isStale" ref="aiWarningRef">
            <div class="flex items-start p-3 bg-nc-bg-purple-light gap-4">
              <GeneralIcon icon="alertTriangleSolid" class="text-nc-content-purple-medium h-4 w-4 flex-none" />
              <div class="flex flex-col">
                <div class="font-bold text-small leading-[18px] text-nc-content-gray">Record Data Updated</div>
                <div class="text-small leading-[18px] text-nc-content-gray-muted">
                  Cell values in this record have been updated. Regenerate to get more accurate content.
                </div>
              </div>
            </div>
          </div>

          <div v-if="!isEditColumn" class="flex items-center gap-2 px-3 py-0.5 !text-small leading-[18px]">
            <span class="text-nc-content-purple-light truncate">Generated by AI</span>
            <NcTooltip v-if="isAiEdited" class="text-nc-content-green-dark flex-1 truncate" show-on-truncate-only>
              <template #title> Edited by you </template>
              Edited by you
            </NcTooltip>
            <NcTooltip
              v-else-if="props.aiMeta?.lastModifiedBy && idUserMap[props.aiMeta?.lastModifiedBy]"
              class="text-nc-content-green-dark flex-1 truncate"
              show-on-truncate-only
            >
              <template #title>
                Edited by
                {{
                  user?.id === props.aiMeta?.lastModifiedBy
                    ? 'you'
                    : idUserMap[props.aiMeta?.lastModifiedBy]?.display_name || idUserMap[props.aiMeta?.lastModifiedBy]?.email
                }}
              </template>
              Edited by
              {{
                user?.id === props.aiMeta?.lastModifiedBy
                  ? 'you'
                  : idUserMap[props.aiMeta?.lastModifiedBy]?.display_name || idUserMap[props.aiMeta?.lastModifiedBy]?.email
              }}
            </NcTooltip>
            <div v-else class="flex-1"></div>

            <NcTooltip :disabled="isFieldAiIntegrationAvailable" class="flex">
              <template #title>
                {{
                  aiIntegrations.length ? $t('tooltip.aiIntegrationReConfigure') : $t('tooltip.aiIntegrationAddAndReConfigure')
                }}
              </template>
              <NcButton
                type="text"
                theme="ai"
                size="xs"
                :disabled="!isFieldAiIntegrationAvailable"
                :loading="isAiGenerating"
                @click.stop="generate"
              >
                <template #icon>
                  <GeneralIcon icon="ncAutoAwesome" class="h-4 w-4" />
                </template>
                <template #loading> Re-generating... </template>
                Re-generate
              </NcButton>
            </NcTooltip>
          </div>
        </div>
      </div>

      <span v-else-if="vModel === null && showNull" class="nc-null uppercase">{{ $t('general.null') }}</span>

      <LazyCellClampedText
        v-else-if="rowHeight"
        :value="vModel"
        :lines="rowHeightTruncateLines(localRowHeight)"
        class="nc-text-area-clamped-text"
        :style="{
          'word-break': 'break-word',
          'max-height': `${25 * rowHeightTruncateLines(localRowHeight)}px`,
          'my-auto': rowHeightTruncateLines(localRowHeight) === 1,
        }"
        @click="onTextClick"
      />

      <span v-else>{{ vModel }}</span>

      <div
        class="!absolute !hidden nc-text-area-expand-btn group-hover:block z-3 flex items-center gap-1"
        :class="{
          'right-1': isForm,
          'right-0': !isForm,
          'top-0 right-0': isGrid && !isExpandedFormOpen && !isForm,
          '!right-2 top-2': isGrid && !isExpandedFormOpen && !isForm && !isRichMode && ((editEnabled && !isVisible) || isForm),
          'top-1': !(isGrid && !isExpandedFormOpen && !isForm),
        }"
      >
        <NcTooltip
          v-if="!isVisible && !isForm && !readOnly && props.isAi && !isExpandedFormOpen && !isEditColumn"
          placement="bottom"
          class="nc-action-icon"
        >
          <template #title>
            {{ isAiGenerating ? 'Re-generating...' : 'Re-generate' }}
          </template>
          <NcButton
            type="secondary"
            size="xsmall"
            class="!p-0 !w-5 !h-5 !min-w-[fit-content] nc-textarea-generate"
            :disabled="isAiGenerating"
            loader-size="small"
            icon-only
            @click.stop="generate"
          >
            <template #icon>
              <GeneralIcon
                icon="refresh"
                class="transform group-hover:(!text-grey-800) text-gray-700 w-3 h-3"
                :class="{ 'animate-infinite animate-spin': isAiGenerating }"
              />
            </template>
          </NcButton>
        </NcTooltip>
        <NcTooltip v-if="!isVisible && !isForm" placement="bottom" class="nc-action-icon">
          <template #title>{{ $t('title.expand') }}</template>
          <NcButton
            type="secondary"
            size="xsmall"
            class="nc-textarea-expand !p-0 !w-5 !h-5 !min-w-[fit-content]"
            @click.stop="onExpand"
          >
            <component :is="iconMap.maximize" class="transform group-hover:(!text-grey-800) text-gray-700 w-3 h-3" />
          </NcButton>
        </NcTooltip>
      </div>
    </div>
    <a-modal
      v-if="isVisible"
      v-model:visible="isVisible"
      :closable="false"
      :footer="null"
      wrap-class-name="nc-long-text-expanded-modal"
      :mask="true"
      :mask-closable="false"
      :mask-style="{ zIndex: 1051 }"
      :z-index="1052"
    >
      <div
        ref="inputWrapperRef"
        class="flex flex-col pb-3 w-full expanded-cell-input relative"
        :class="{
          'cursor-move': isDragging,
          'expanded-cell-input-ai': props.isAi,
        }"
        @keydown.enter.stop
      >
        <div
          v-if="column"
          class="flex flex-row gap-x-1 items-center font-medium pl-3 pb-2.5 pt-3 border-b-1 border-gray-100 overflow-hidden"
          :class="{
            'select-none': isDragging,
            'cursor-move': !isEditColumn,
          }"
          @mousedown="dragStart"
        >
          <SmartsheetHeaderCellIcon
            class="flex"
            :class="{
              '!w-6 !h-6': props.isAi,
            }"
          />
          <div
            class="flex max-w-38"
            :class="{
              'text-xl': props.isAi,
            }"
          >
            <span class="truncate">
              {{ column.title }}
            </span>
          </div>
          <template v-if="!props.isAi && !isRichMode">
            <div class="flex-1" />

            <NcButton class="mr-2" type="text" size="small" @click="isVisible = false">
              <GeneralIcon icon="close" />
            </NcButton>
          </template>
          <template v-if="props.isAi && !isEditColumn">
            <div class="flex items-center text-small leading-[18px] gap-3 ml-2">
              <span class="text-nc-content-purple-dark truncate">Generated by AI</span>
              <template v-if="!readOnly">
                <span v-if="isAiEdited" class="text-nc-content-green-dark truncate"> Edited by you </span>
                <span v-else-if="props.aiMeta?.lastModifiedBy && idUserMap[props.aiMeta?.lastModifiedBy]" class="text-green-600">
                  Edited by
                  {{
                    user?.id === props.aiMeta?.lastModifiedBy
                      ? 'you'
                      : idUserMap[props.aiMeta?.lastModifiedBy]?.display_name || idUserMap[props.aiMeta?.lastModifiedBy]?.email
                  }}
                </span>
              </template>
            </div>
            <div class="flex-1"></div>
            <div v-if="!readOnly" class="flex items-center gap-1 mr-4">
              <NcTooltip :disabled="isFieldAiIntegrationAvailable" class="flex">
                <template #title>
                  {{
                    aiIntegrations.length ? $t('tooltip.aiIntegrationReConfigure') : $t('tooltip.aiIntegrationAddAndReConfigure')
                  }}
                </template>
                <NcButton
                  type="secondary"
                  :bordered="false"
                  theme="ai"
                  size="small"
                  :disabled="!isFieldAiIntegrationAvailable"
                  @click.stop="generate"
                >
                  <div class="flex items-center gap-2">
                    <GeneralIcon icon="refresh" :class="{ 'animate-infinite animate-spin': isAiGenerating }" />
                    <span class="text-sm font-bold"> {{ isAiGenerating ? 'Re-generating...' : 'Re-generate' }} </span>
                  </div>
                </NcButton>
              </NcTooltip>
            </div>
          </template>
        </div>
        <div v-if="props.isAi && props.aiMeta?.isStale && !readOnly" ref="aiWarningRef" class="border-b-1 border-gray-100">
          <div class="flex items-center p-4 bg-nc-bg-purple-light gap-4">
            <GeneralIcon icon="alertTriangleSolid" class="text-nc-content-purple-medium h-6 w-6 flex-none" />
            <div class="flex flex-col">
              <div class="font-bold text-base text-nc-content-gray">Record Data Updated</div>
              <div class="text-nc-content-gray-muted text-sm">
                Cell values in this record have been updated since the last time this content was generated. Regenerate to get
                more accurate content.
              </div>
            </div>
          </div>
        </div>
        <div v-if="!isRichMode" class="p-3 pb-0 h-full">
          <a-textarea
            ref="inputRef"
            v-model:value="vModel"
            class="nc-text-area-expanded !py-1 !px-3 !text-black !transition-none !cursor-text !min-h-[210px] !rounded-lg focus:border-brand-500 disabled:!bg-gray-50 nc-longtext-scrollbar"
            :placeholder="$t('activity.enterText')"
            :style="{
              resize: 'both',
              maxHeight: props.isAi
                ? `min(795px - ${aiWarningRefHeight + 8}px, 100vh - 170px - ${aiWarningRefHeight + 8}px)`
                : 'min(795px, 100vh - 170px)',
            }"
            :disabled="readOnly || (props.isAi && aiLoading) || (props.isAi && isEditColumn)"
            @keydown.escape="isVisible = false"
            @keydown.alt.stop
          />
        </div>

        <LazyCellRichText v-else v-model:value="vModel" show-menu full-mode :read-only="readOnly" @close="handleClose" />
      </div>
    </a-modal>
  </div>
</template>

<style lang="scss" scoped>
textarea:focus {
  box-shadow: none;
}
.nc-text-area-expanded {
  @apply h-[min(795px,100vh_-_300px)] w-[min(1256px,100vw_-_124px)];

  max-height: min(795px, 100vh - 170px);
  min-width: -webkit-fill-available;
  max-width: min(1256px, 100vw - 126px);
  transition-property: shadow, colors, border;
  scrollbar-width: thin !important;
  &::-webkit-scrollbar-thumb {
    @apply rounded-lg;
  }
}
.nc-longtext-scrollbar {
  @apply scrollbar-thin scrollbar-thumb-gray-200 hover:scrollbar-thumb-gray-300 scrollbar-track-transparent;
}

.nc-readonly-rich-text-wrapper {
  &.nc-readonly-rich-text-grid {
    :deep(.ProseMirror) {
      @apply !pt-0;
    }
    // &.nc-readonly-rich-text-sort-height {
    //   @apply mt-1;
    // }
  }
}
</style>

<style lang="scss">
.cell:hover .nc-text-area-expand-btn,
.long-text-wrapper:hover .nc-text-area-expand-btn {
  @apply !flex cursor-pointer;
}

.nc-grid-cell {
  &.align-top {
    .long-text-wrapper {
      @apply items-start;
    }
  }

  &:not(.align-top) {
    @apply items-center;
  }
}

.nc-data-cell {
  &:has(.nc-cell-longtext-ai .nc-expanded-form-open) {
    @apply !border-none -mx-1 -my-1;
    box-shadow: none !important;

    &:focus-within:not(.nc-readonly-div-data-cell):not(.nc-system-field) {
      box-shadow: none !important;
    }

    .nc-text-area-expand-btn {
      @apply top-2 right-1;
    }
  }
}

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

      .expanded-cell-input-ai {
        .nc-text-area-expanded {
          max-height: min(783px - 76px, 100vh - 180px);
        }
      }
    }
  }
}
</style>

<style lang="scss"></style>
