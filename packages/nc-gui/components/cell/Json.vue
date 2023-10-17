<script setup lang="ts">
import NcModal from '../nc/Modal.vue'
import {
  ActiveCellInj,
  EditModeInj,
  IsFormInj,
  JsonExpandInj,
  ReadonlyInj,
  RowHeightInj,
  computed,
  inject,
  ref,
  useSelectedCellKeyupListener,
  useVModel,
  watch,
} from '#imports'

interface Props {
  modelValue: string | Record<string, any> | undefined
}

interface Emits {
  (event: 'update:modelValue', model: string): void
}

const props = defineProps<Props>()

const emits = defineEmits<Emits>()

const { showNull } = useGlobal()

const editEnabled = inject(EditModeInj, ref(false))

const active = inject(ActiveCellInj, ref(false))

const isForm = inject(IsFormInj, ref(false))

const readonly = inject(ReadonlyInj)

const vModel = useVModel(props, 'modelValue', emits)

const localValueState = ref<string | undefined>()

const error = ref<string | undefined>()

const _isExpanded = inject(JsonExpandInj, ref(false))

const isExpanded = ref(false)

const rowHeight = inject(RowHeightInj, ref(undefined))

const localValue = computed<string | Record<string, any> | undefined>({
  get: () => localValueState.value,
  set: (val: undefined | string | Record<string, any>) => {
    localValueState.value = typeof val === 'object' ? JSON.stringify(val, null, 2) : val
    /** if form and not expanded then sync directly */
    if (isForm.value && !isExpanded.value) {
      vModel.value = val
    }
  },
})

const clear = () => {
  error.value = undefined

  isExpanded.value = false

  editEnabled.value = false

  localValue.value = vModel.value
}

const formatJson = (json: string) => {
  try {
    json = json
      .trim()
      .replace(/^\{\s*|\s*\}$/g, '')
      .replace(/\n\s*/g, '')
    json = `{${json}}`

    return json
  } catch (e) {
    console.log(e)
    return json
  }
}

const onSave = () => {
  isExpanded.value = false

  editEnabled.value = false

  vModel.value = localValue ? formatJson(localValue.value as string) : localValue
}

const setLocalValue = (val: any) => {
  try {
    localValue.value = typeof val === 'string' ? JSON.stringify(JSON.parse(val), null, 2) : val
  } catch (e) {
    localValue.value = val
  }
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
    if (localValue.value === undefined) return

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
</script>

<template>
  <component :is="isExpanded ? NcModal : 'div'" v-model:visible="isExpanded" :closable="false" centered :footer="null">
    <div v-if="editEnabled && !readonly" class="flex flex-col w-full" @mousedown.stop @mouseup.stop @click.stop>
      <div class="flex flex-row justify-between pt-1 pb-2 nc-json-action" @mousedown.stop>
        <a-button type="text" size="small" @click="isExpanded = !isExpanded">
          <CilFullscreenExit v-if="isExpanded" class="h-2.5" />

          <CilFullscreen v-else class="h-2.5" />
        </a-button>

        <div v-if="!isForm || isExpanded" class="flex flex-row my-1">
          <a-button type="text" size="small" :onclick="clear"
            ><div class="text-xs">{{ $t('general.cancel') }}</div></a-button
          >

          <a-button type="primary" size="small" :disabled="!!error || localValue === vModel" @click="onSave">
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
        @update:model-value="localValue = $event"
      />

      <span v-if="error" class="text-xs w-full py-1 text-red-500">
        {{ error.toString() }}
      </span>
    </div>

    <span v-else-if="vModel === null && showNull" class="nc-null uppercase">{{ $t('general.null') }}</span>

    <LazyCellClampedText v-else :value="vModel" :lines="rowHeight" />
  </component>
</template>

<style scoped lang="scss">
.expanded-editor {
  min-height: min(600px, 80vh);
}

.editor {
  min-height: min(200px, 10vh);
}
</style>
