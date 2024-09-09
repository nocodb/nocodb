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

const isEditColumn = inject(EditColumnInj, ref(false))

const isForm = inject(IsFormInj, ref(false))

const readOnly = inject(ReadonlyInj, ref(false))

const vModel = useVModel(props, 'modelValue', emits)

const localValueState = ref<string | undefined | null>()

const error = ref<string | undefined>()

const _isExpanded = inject(JsonExpandInj, ref(false))

const isExpanded = ref(false)

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

  isExpanded.value = false

  editEnabled.value = false

  setLocalValue(vModel.value)
}

const onSave = () => {
  isExpanded.value = false

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
  isExpanded.value = false

  setLocalValue(vModel.value)
})

useSelectedCellKeyupListener(active, (e) => {
  switch (e.key) {
    case 'Enter':
      e.stopPropagation()
      if (e.shiftKey) {
        return true
      }
      if (editEnabled.value) {
        onSave()
      } else {
        editEnabled.value = true
      }
      break
  }
})

const inputWrapperRef = ref<HTMLElement | null>(null)

onClickOutside(inputWrapperRef, (e) => {
  if ((e.target as HTMLElement)?.closest('.nc-json-action')) return
  editEnabled.value = false
})

watch(isExpanded, () => {
  _isExpanded.value = isExpanded.value
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
</script>

<template>
  <component
    :is="isExpanded ? NcModal : 'div'"
    v-model:visible="isExpanded"
    :closable="false"
    centered
    :footer="null"
    :wrap-class-name="isExpanded ? '!z-1051 nc-json-expanded-modal' : null"
  >
    <div v-if="editEnabled && !readOnly" class="flex flex-col w-full" @mousedown.stop @mouseup.stop @click.stop>
      <div class="flex flex-row justify-between pt-1 pb-2 nc-json-action" @mousedown.stop>
        <a-button type="text" size="small" @click="isExpanded = !isExpanded">
          <CilFullscreenExit v-if="isExpanded" class="h-2.5" />

          <CilFullscreen v-else class="h-2.5" />
        </a-button>

        <div v-if="!isForm || isExpanded" class="flex flex-row my-1 space-x-1">
          <a-button type="text" size="small" class="!rounded-lg" @click="clear"
            ><div class="text-xs">{{ $t('general.cancel') }}</div></a-button
          >

          <a-button
            :type="!isExpanded ? 'text' : 'primary'"
            size="small"
            class="nc-save-json-value-btn !rounded-lg"
            :class="{
              'nc-edit-modal': !isExpanded,
            }"
            :disabled="!!error || localValue === vModel"
            @click="onSave"
          >
            <div class="text-xs">{{ $t('general.save') }}</div>
          </a-button>
        </div>
      </div>

      <LazyMonacoEditor
        ref="inputWrapperRef"
        :model-value="localValue || ''"
        class="min-w-full w-80"
        :class="{ 'expanded-editor': isExpanded, 'editor': !isExpanded }"
        :hide-minimap="true"
        :disable-deep-compare="true"
        :auto-focus="!isForm && !isEditColumn"
        @update:model-value="localValue = $event"
        @keydown.enter.stop
      />

      <span v-if="error" class="nc-cell-field text-xs w-full py-1 text-red-500">
        {{ error.toString() }}
      </span>
    </div>

    <span v-else-if="vModel === null && showNull" class="nc-cell-field nc-null uppercase">{{ $t('general.null') }}</span>

    <LazyCellClampedText v-else :value="vModel ? stringifyProp(vModel) : ''" :lines="rowHeight" class="nc-cell-field" />
  </component>
</template>

<style scoped lang="scss">
.expanded-editor {
  min-height: min(600px, 80vh);
}

.editor {
  min-height: min(200px, 10vh);
}

.nc-save-json-value-btn {
  &.nc-edit-modal:not(:disabled) {
    @apply !text-brand-500 !hover:text-brand-600;
  }
}
</style>
