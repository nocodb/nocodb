<script setup lang="ts">
const { t } = useI18n()

const { isModalVisible } = useChatWoot()

const toggleVisibility = () => {
  // if chatwoot is not initialized, show a message
  if (!isModalVisible.value && !ncIsFunction(window.$chatwoot?.toggle)) {
    message.info({
      title: t('msg.info.supportChatUnavailable'),
      content: t('msg.info.supportChatUnavailableSubtitle'),
    })
    return
  }

  const toggleText = (isModalVisible.value ? 'hide' : 'show') as any
  window.$chatwoot.toggle(toggleText)
}
</script>

<template>
  <div v-e="['c:nocodb:chat-support']" class="nc-mini-sidebar-btn-full-width" data-testid="nc-sidebar-chat-support">
    <div
      class="nc-mini-sidebar-btn relative"
      :class="{
        active: isModalVisible,
      }"
      @click="toggleVisibility"
    >
      <GeneralIcon icon="ncSupportAgent" class="h-4.5 w-4.5" />
    </div>
  </div>
</template>
