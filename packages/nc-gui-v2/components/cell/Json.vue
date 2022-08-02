<script setup lang="ts">
import { Modal as AModal } from 'ant-design-vue'
import Editor from '~/components/monaco/Editor.vue'
import FullScreenIcon from '~icons/cil/fullscreen'
import FullScreenExitIcon from '~icons/cil/fullscreen-exit'
import { inject, onMounted } from '#imports'
import { EditModeInj } from '~/context'

interface Props {
  modelValue: any
}

interface Emits {
  (event: 'update:modelValue', model: any): void
}

const props = defineProps<Props>()

const emits = defineEmits<Emits>()

let editEnabled = $(inject(EditModeInj))

let vModel = $(useVModel(props, 'modelValue', emits))

let localValue = $ref({})
let error = $ref<string | undefined>(undefined)
let isExpanded = $ref(false)

const onError = (e: any) => {
  error = e
}

const clear = () => {
  error = undefined
  isExpanded = false
  editEnabled = false

  localValue = JSON.parse(vModel)
}

const onSave = () => {
  vModel = JSON.stringify(localValue)
  isExpanded = false
}

const resetError = () => {
  error = undefined
}

onMounted(() => {
  localValue = JSON.parse(vModel)
})

watch(
  () => editEnabled,
  () => {
    isExpanded = false
    localValue = JSON.parse(vModel)
  },
)
</script>

<template>
  <component :is="isExpanded ? AModal : 'div'" v-model:visible="isExpanded" :closable="false" centered :footer="null">
    <div v-if="editEnabled" class="flex flex-col w-full">
      <div class="flex flex-row justify-between pt-1 pb-2">
        <a-button type="text" size="small" @click="isExpanded = !isExpanded">
          <FullScreenExitIcon v-if="isExpanded" class="h-2.5" />
          <FullScreenIcon v-else class="h-2.5" />
        </a-button>
        <div class="flex flex-row">
          <a-button type="text" size="small" :onclick="clear"><div class="text-xs">Cancel</div></a-button>
          <a-button type="primary" size="small" :disabled="!!error"><div class="text-xs" :onclick="onSave">Save</div></a-button>
        </div>
      </div>
      <Editor
        :model-value="localValue"
        class="min-w-full w-80"
        :class="{ 'expanded-editor': isExpanded, 'editor': !isExpanded }"
        :hide-minimap="true"
        @validation-error="onError"
        @update:model-value="localValue = $event"
        @value-changed="resetError"
      />
      <span v-if="error" class="text-xs w-full py-1 text-red-500">
        {{ error?.toString() }}
      </span>
    </div>
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
