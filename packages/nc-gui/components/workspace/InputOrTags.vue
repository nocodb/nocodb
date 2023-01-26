<script setup lang="ts">
import type { VNodeRef } from '@vue/runtime-core'
import type { Input } from 'ant-design-vue'
import { nextTick } from '#imports'

const props = withDefaults(
  defineProps<{
    modelValue: string
  }>(),
  { modelValue: '' },
)

const emits = defineEmits(['update:modelValue'])

const vModel = useVModel(props, 'modelValue', emits)

let inputValue = $ref('')

const inputRef = $ref<typeof Input>()

let isMultiWorkspace = $ref(false)

const focusInput = () => {
  nextTick(() => {
    inputRef?.focus()
  })
}

let title = $computed<string | string[]>({
  set(title) {
    if (Array.isArray(title)) {
      if (title.length === 0 && !inputValue) isMultiWorkspace = false
      vModel.value = title.join()
    } else {
      if (title.includes(',')) isMultiWorkspace = true
      focusInput()
      vModel.value = title
    }
  },
  get() {
    return isMultiWorkspace ? vModel.value?.split(',').filter(Boolean) ?? [] : vModel.value ?? ''
  },
})

const handleInputConfirm = () => {
  title = [...title, inputValue]
  inputValue = ''
}

const onKeydown = (e: KeyboardEvent) => {
  if (e.key === 'Backspace' && inputValue === '') {
    inputValue = (title as string[]).pop() as string
    title = [...title]
    e.preventDefault()
  } else if (e.key === ','){
    e.preventDefault()
    title = [...title, inputValue]
    inputValue = ''
  }
}

const inputTextEl: VNodeRef = (el) => {
  ;(el as HTMLInputElement)?.focus()
}
</script>

<template>
  <div
    v-if="isMultiWorkspace"
    class="min-h-10 border-gray-300 border-1 rounded-sm flex items-center flex-wrap p-2 gap-y-2"
    @click="focusInput"
  >
    <template v-for="(tag, index) in title" :key="tag">
      <a-tooltip v-if="tag.length > 20" closable :title="tag">
        <a-tag @close="title = title.filter((_, i) => i !== index)" @click.stop>
          {{ `${tag.slice(0, 20)}...` }}
        </a-tag>
      </a-tooltip>
      <a-tag v-else closable @close="title = title.filter((_, i) => i !== index)" @click.stop>
        {{ tag }}
      </a-tag>
    </template>
    <a-input
      ref="inputRef"
      v-model:value="inputValue"
      type="text"
      size="small"
      class="min-w-20 flex-grow !w-auto"
      @click.stop
      @blur="handleInputConfirm"
      @keyup.enter="handleInputConfirm"
      @keydown.stop="onKeydown"
    />
  </div>
  <a-input
    v-else
    ref="inputTextEl"
    v-model:value="title"
    size="large"
    hide-details
    data-testid="create-workspace-title-input"
    placeholder="Workspace name"
  />
</template>

<style scoped>
:deep(.ant-tag) {
  @apply flex items-center;
}
</style>
