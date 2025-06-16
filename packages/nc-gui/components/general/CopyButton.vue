<script setup lang="ts">
import type { NcButtonProps } from '../nc/Button.vue'

export interface GeneralCopyButtonProps extends NcButtonProps {
  content?: string | number
  timeout?: number
  showToast?: boolean
}
const props = withDefaults(defineProps<GeneralCopyButtonProps>(), {
  size: 'xsmall',
  type: 'text',
  innerClass: 'justify-center',
  showToast: true,
  bordered: true,
})

const { content: _content, timeout: _timeout, showToast, ...restButtonProps } = props

const { content } = toRefs(props)

const { t } = useI18n()

const { copy } = useCopy()

const isCopied = ref(false)

let copiedTimeoutId: any

const copyContent = async (text?: GeneralCopyButtonProps['content']) => {
  if (copiedTimeoutId) {
    clearTimeout(copiedTimeoutId)
  }

  const copyText = (text ?? content.value)?.toString()?.trim()

  if (!copyText) return

  try {
    await copy(copyText)

    if (showToast) {
      message.toast(t('msg.info.copiedToClipboard'))
    }

    isCopied.value = true

    copiedTimeoutId = setTimeout(() => {
      isCopied.value = false
      clearTimeout(copiedTimeoutId)
    }, props.timeout || 3000)
  } catch (e: any) {
    message.error(e.message)
  }
}

defineExpose({
  copyContent,
})
</script>

<template>
  <NcButton v-bind="restButtonProps" @click="copyContent">
    <div class="flex children:flex-none relative h-4 w-4">
      <Transition name="icon-fade" :duration="200">
        <GeneralIcon v-if="isCopied" icon="check" class="h-4 w-4 opacity-80" />
        <GeneralIcon v-else icon="copy" class="h-4 w-4 opacity-80" />
      </Transition>
    </div>
  </NcButton>
</template>
