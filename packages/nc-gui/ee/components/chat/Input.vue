<script setup lang="ts">
interface Props {
  disabled?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  disabled: false,
})

const emit = defineEmits<{
  send: [content: string]
}>()

const { disabled } = toRefs(props)

const { t } = useI18n()

const inputValue = ref('')

const textareaRef = ref<HTMLTextAreaElement>()

const { textarea: _textareaAutosize } = useTextareaAutosize({
  element: textareaRef,
  input: inputValue,
})

const canSend = computed(() => {
  return inputValue.value.trim().length > 0 && !disabled.value
})

const handleSubmit = () => {
  if (!canSend.value) return

  emit('send', inputValue.value.trim())
  inputValue.value = ''

  // Reset textarea height
  nextTick(() => {
    if (textareaRef.value) {
      textareaRef.value.style.height = 'auto'
    }
  })
}

const handleKeyDown = (e: KeyboardEvent) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    handleSubmit()
  }
}
</script>

<template>
  <div class="nc-chat-input border-t-1 border-nc-border-gray-medium bg-nc-bg-default px-4 py-3">
    <div class="flex items-end gap-2">
      <textarea
        ref="textareaRef"
        v-model="inputValue"
        :placeholder="t('placeholder.askAnything')"
        :disabled="disabled"
        class="flex-1 resize-none border-1 border-nc-border-gray-medium rounded-lg px-3 py-2 text-sm bg-nc-bg-default text-nc-content-gray-emphasis placeholder:text-nc-content-gray-subtle focus:outline-none focus:border-nc-fill-primary nc-scrollbar-thin"
        :class="{ 'opacity-50': disabled }"
        rows="1"
        style="max-height: 120px"
        @keydown.stop="handleKeyDown"
      />

      <NcButton
        v-e="['c:chat:send-message']"
        size="small"
        type="primary"
        class="flex-none"
        :disabled="!canSend"
        @click="handleSubmit"
      >
        <GeneralIcon icon="send" class="w-4 h-4" />
      </NcButton>
    </div>
  </div>
</template>
