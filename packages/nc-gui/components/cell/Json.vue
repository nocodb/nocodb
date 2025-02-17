<script setup lang="ts">
import NcModal from '../nc/Modal.vue'

type ModelValueType = string | Record<string, any> | undefined | null

interface Props {
  modelValue: ModelValueType
}

interface Emits {
  (event: 'update:modelValue', model: string | null): void
}

const props = defineProps<Props>()

const emits = defineEmits<Emits>()

const { showNull } = useGlobal()

const editEnabled = inject(EditModeInj, ref(false))

const active = inject(ActiveCellInj, ref(false))
const canvasSelectCell = inject(CanvasSelectCellInj)

const isEditColumn = inject(EditColumnInj, ref(false))

const isForm = inject(IsFormInj, ref(false))

const readOnly = inject(ReadonlyInj, ref(false))

const vModel = useVModel(props, 'modelValue', emits)

const localValueState = ref<string | undefined | null>()

const error = ref<string | undefined>()

const _isExpanded = inject(JsonExpandInj, ref(false))

const isExpanded = ref(false)

const isExpandedFormOpen = inject(IsExpandedFormOpenInj, ref(false))

const rowHeight = inject(RowHeightInj, ref(undefined))

const formatValue = (val: ModelValueType) => {
  return !val || val === 'null' ? null : val
}

const localValue = computed<ModelValueType>({
  get: () => localValueState.value,
  set: (val: ModelValueType) => {
    localValueState.value = formatValue(val) === null ? null : typeof val === 'object' ? JSON.stringify(val, null, 2) : val
    /** if form and not expanded then sync directly */
    if (isForm.value && !isExpanded.value) {
      vModel.value = formatValue(val) === null ? null : val
    }
  },
})

function openJSONEditor(e?: Event) {
  const target = e?.target as HTMLElement
  if (target?.classList?.contains('default-value-clear')) return
  isExpanded.value = true
}

function closeJSONEditor() {
  isExpanded.value = false
}

const formatJson = (json: string) => {
  try {
    return JSON.stringify(JSON.parse(json))
  } catch (e) {
    console.log(e)
    return json
  }
}

function setLocalValue(val: any) {
  try {
    localValue.value = formatValue(val) === null ? null : typeof val === 'string' ? JSON.stringify(JSON.parse(val), null, 2) : val
  } catch (e) {
    localValue.value = formatValue(val) === null ? null : val
  }
}

const clear = () => {
  error.value = undefined

  closeJSONEditor()

  editEnabled.value = false

  setLocalValue(vModel.value)
}

const onSave = () => {
  closeJSONEditor()

  editEnabled.value = false

  // avoid saving if error exists or value is same as previous
  if (error.value || localValue.value === vModel.value) return false

  vModel.value = formatValue(localValue.value) === null ? null : formatJson(localValue.value as string)
}

watch(
  vModel,
  (val) => {
    setLocalValue(val)
  },
  { immediate: true },
)

watch([localValue, editEnabled], () => {
  try {
    JSON.parse(localValue.value as string)

    error.value = undefined
  } catch (e: any) {
    if (localValue.value === undefined || localValue.value === null) return

    error.value = e
  }
})

watch(editEnabled, () => {
  closeJSONEditor()

  setLocalValue(vModel.value)
})

useSelectedCellKeydownListener(active, (e) => {
  if (readOnly.value) return
  switch (true) {
    case e.key === 'Enter':
      e.preventDefault()
      e.stopPropagation()
      if (e.shiftKey) {
        return true
      }
      openJSONEditor()
      break
    case e.metaKey:
    case e.altKey:
    case e.ctrlKey:
    case e.key === 'Backspace':
    case e.key === 'Spacebar' || e.key === ' ':
    case [...e.key].length > 1:
      // The string iterator that is used here iterates over characters, not mere code units
      // If a key is a modifier key or navigation key or function key or any of the
      // non-printing keys, ignore them
      break
    default:
      // Otherwise it's a printing character, append it and open the JSON modal for editing
      if (typeof localValue.value === 'string') {
        localValue.value += e.key
      } else if (!localValue.value) {
        localValue.value = e.key
      }
      openJSONEditor()
  }
})

const inputWrapperRef = ref<HTMLElement | null>(null)

onClickOutside(inputWrapperRef, (e) => {
  if ((e.target as HTMLElement)?.closest('.nc-json-action')) return
  editEnabled.value = false
})

watch(isExpanded, (newVal, oldVal) => {
  _isExpanded.value = isExpanded.value

  if (oldVal && !newVal) canvasSelectCell?.trigger()
})

const stopPropagation = (event: MouseEvent) => {
  event.stopPropagation()
}

watch(inputWrapperRef, () => {
  if (!isEditColumn.value) return

  // stop event propogation in edit to prevent close edit modal on clicking expanded modal overlay
  const modal = document.querySelector('.nc-json-expanded-modal') as HTMLElement

  if (isExpanded.value && modal?.parentElement) {
    modal.parentElement.addEventListener('click', stopPropagation)
    modal.parentElement.addEventListener('mousedown', stopPropagation)
    modal.parentElement.addEventListener('mouseup', stopPropagation)
  } else if (modal?.parentElement) {
    modal.parentElement.removeEventListener('click', stopPropagation)
    modal.parentElement.removeEventListener('mousedown', stopPropagation)
    modal.parentElement.removeEventListener('mouseup', stopPropagation)
  }
})

const el = useCurrentElement()
const isCanvasInjected = inject(IsCanvasInjectionInj, false)
const isUnderLookup = inject(IsUnderLookupInj, ref(false))

onMounted(() => {
  if (
    !isUnderLookup.value &&
    isCanvasInjected &&
    !isExpanded.value &&
    !isEditColumn.value &&
    !isForm.value &&
    !isExpandedFormOpen.value
  ) {
    forcedNextTick(() => {
      openJSONEditor()
    })
  }

  const gridCell = el.value?.closest('td')
  if (gridCell && !readOnly.value) {
    gridCell.addEventListener('dblclick', openJSONEditor)
    return
  }
  const container = el.value?.closest('.nc-data-cell, .nc-default-value-wrapper')
  if (container) container.addEventListener('click', openJSONEditor)
})

onUnmounted(() => {
  const gridCell = el.value?.closest?.('td')
  if (gridCell && !readOnly.value) {
    gridCell.removeEventListener('dblclick', openJSONEditor)
    return
  }
  const container = el.value?.closest?.('.nc-data-cell, .nc-default-value-wrapper')
  if (container) container.removeEventListener('click', openJSONEditor)
})
</script>

<template>
  <component
    :is="isExpanded ? NcModal : 'div'"
    v-model:visible="isExpanded"
    width="auto"
    :closable="false"
    centered
    :footer="null"
    :wrap-class-name="isExpanded ? '!z-1051 nc-json-expanded-modal' : null"
    class="relative"
    :class="{ 'json-modal min-w-80': isExpanded }"
  >
    <div v-if="isExpanded" class="flex flex-col w-full" @mousedown.stop @mouseup.stop @click.stop>
      <div class="flex flex-row justify-between items-center -mt-2 pb-3 nc-json-action" @mousedown.stop>
        <NcButton type="secondary" size="xsmall" class="!w-7 !h-7 !min-w-[fit-content]" @click.stop="closeJSONEditor">
          <component :is="iconMap.minimize" class="w-4 h-4" />
        </NcButton>

        <div v-if="!readOnly" class="flex gap-2">
          <NcButton type="secondary" size="small" @click="clear">{{ $t('general.cancel') }}</NcButton>
          <NcButton type="primary" size="small" :disabled="!!error || localValue === vModel" @click="onSave">
            {{ $t('general.save') }}
          </NcButton>
        </div>
        <div v-else></div>
      </div>

      <LazyMonacoEditor
        ref="inputWrapperRef"
        :model-value="localValue || ''"
        class="min-w-full w-[40rem] resize overflow-auto expanded-editor"
        :hide-minimap="true"
        :disable-deep-compare="true"
        :auto-focus="true"
        :read-only="readOnly"
        @update:model-value="localValue = $event"
        @keydown.enter.stop
        @keydown.alt.stop
      />

      <span v-if="error" class="nc-cell-field text-xs w-full py-1 text-red-500">
        {{ error.toString() }}
      </span>
    </div>
    <span v-else-if="vModel === null && showNull" class="nc-cell-field nc-null uppercase">{{ $t('general.null') }}</span>
    <LazyCellClampedText v-else :value="vModel ? stringifyProp(vModel) : ''" :lines="rowHeight" class="nc-cell-field" />
    <NcTooltip placement="bottom" class="nc-json-expand-btn hidden absolute top-0 right-0">
      <template #title>{{ $t('title.expand') }}</template>
      <NcButton type="secondary" size="xsmall" class="!w-5 !h-5 !min-w-[fit-content]" @click.stop="openJSONEditor">
        <component :is="iconMap.maximize" class="w-3 h-3" />
      </NcButton>
    </NcTooltip>
  </component>
</template>

<style scoped lang="scss">
.expanded-editor {
  height: min(600px, 80vh);
  min-height: 300px;
  max-height: 85vh;
  max-width: 90vw;
}
</style>

<style lang="scss">
.nc-cell-json:hover .nc-json-expand-btn,
.nc-grid-cell:hover .nc-json-expand-btn {
  @apply block;
}
.nc-default-value-wrapper .nc-cell-json,
.nc-grid-cell .nc-cell-json {
  min-height: 20px !important;
}
.nc-expanded-cell .nc-cell-json .nc-cell-field {
  margin: 4px 0;
}
.nc-expand-col-JSON.nc-expanded-form-row .nc-cell-json {
  min-height: 34px;
}

.nc-default-value-wrapper,
.nc-expanded-cell,
.ant-form-item-control-input {
  .nc-json-expand-btn {
    @apply !block;
  }
}
</style>
