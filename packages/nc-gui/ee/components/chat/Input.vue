<script setup lang="ts">
interface Props {
  disabled?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  disabled: false,
})

const emit = defineEmits<{
  send: [content: string]
  cancel: []
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

  // Reset textarea height and refocus
  nextTick(() => {
    if (textareaRef.value) {
      textareaRef.value.style.height = 'auto'
      textareaRef.value.focus()
    }
  })
}

const handleKeyDown = (e: KeyboardEvent) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    handleSubmit()
  }
}

// Refocus textarea when response completes (disabled goes from true → false)
watch(disabled, (newVal, oldVal) => {
  if (oldVal && !newVal) {
    nextTick(() => {
      textareaRef.value?.focus()
    })
  }
})
</script>

<template>
  <div class="nc-chat-input bg-nc-bg-default px-4 py-3">
    <div
      class="nc-chat-input-box relative border-1 rounded-lg overflow-hidden transition-colors"
      :class="disabled ? 'border-nc-border-gray-medium opacity-50' : 'border-nc-border-gray-medium focus-within:border-nc-fill-primary'"
    >
      <textarea
        ref="textareaRef"
        v-model="inputValue"
        :placeholder="t('placeholder.askAnything')"
        :disabled="disabled"
        class="w-full resize-none rounded-lg px-3 pt-2.5 pb-10 text-sm bg-transparent text-nc-content-gray-emphasis placeholder:text-nc-content-gray-subtle nc-scrollbar-thin"
        rows="2"
        style="outline: none !important; box-shadow: none !important; border: none !important; min-height: 52px; max-height: 160px"
        @keydown.stop="handleKeyDown"
      />

      <div class="absolute bottom-2 right-2">
        <NcButton
          v-if="disabled"
          v-e="['c:chat:cancel-sending']"
          size="small"
          type="secondary"
          class="flex-none"
          @click="emit('cancel')"
        >
          <GeneralIcon icon="ncStopCircle" class="w-4 h-4" />
        </NcButton>

        <NcButton
          v-else
          v-e="['c:chat:send-message']"
          size="small"
          type="primary"
          class="flex-none"
          :disabled="!canSend"
          @click="handleSubmit"
        >
          <GeneralIcon icon="ncSendHorizontal" class="w-4 h-4" />
        </NcButton>
      </div>
    </div>
  </div>
</template>
