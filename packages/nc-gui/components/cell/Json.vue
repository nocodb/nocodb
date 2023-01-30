<script setup lang="ts">
import {
  Modal as AModal,
  ActiveCellInj,
  EditModeInj,
  IsFormInj,
  ReadonlyInj,
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

let error = $ref<string | undefined>()

let isExpanded = $ref(false)

const localValue = computed<string | Record<string, any> | undefined>({
  get: () => localValueState.value,
  set: (val: undefined | string | Record<string, any>) => {
    localValueState.value = typeof val === 'object' ? JSON.stringify(val, null, 2) : val
    /** if form and not expanded then sync directly */
    if (isForm.value && !isExpanded) {
      vModel.value = val
    }
  },
})

const clear = () => {
  error = undefined

  isExpanded = false

  editEnabled.value = false

  localValue.value = vModel.value
}

const formatJson = (json: string) => {
  try {
    return JSON.stringify(JSON.parse(json), null, 2)
  } catch (e) {
    return json
  }
}

const onSave = () => {
  isExpanded = false

  editEnabled.value = false

  localValue.value = localValue ? formatJson(localValue.value as string) : localValue

  vModel.value = localValue.value
}

watch(
  vModel,
  (val) => {
    localValue.value = val
  },
  { immediate: true },
)

watch(localValue, (val) => {
  try {
    JSON.parse(val as string)

    error = undefined
  } catch (e: any) {
    error = e
  }
})

watch(editEnabled, () => {
  isExpanded = false

  localValue.value = vModel.value
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
</script>

<template>
  <component :is="isExpanded ? AModal : 'div'" v-model:visible="isExpanded" :closable="false" centered :footer="null">
    <div v-if="editEnabled && !readonly" class="flex flex-col w-full" @mousedown.stop @mouseup.stop @click.stop>
      <div class="flex flex-row justify-between pt-1 pb-2" @mousedown.stop>
        <a-button type="text" size="small" @click="isExpanded = !isExpanded">
          <CilFullscreenExit v-if="isExpanded" class="h-2.5" />

          <CilFullscreen v-else class="h-2.5" />
        </a-button>

        <div v-if="!isForm || isExpanded" class="flex flex-row">
          <a-button type="text" size="small" :onclick="clear"><div class="text-xs">Cancel</div></a-button>

          <a-button type="primary" size="small" :disabled="!!error || localValue === vModel" @click="onSave">
            <div class="text-xs">Save</div>
          </a-button>
        </div>
      </div>

      <LazyMonacoEditor
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

    <span v-else-if="vModel === null && showNull" class="nc-null">NULL</span>

    <span v-else>{{ vModel }}</span>
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
