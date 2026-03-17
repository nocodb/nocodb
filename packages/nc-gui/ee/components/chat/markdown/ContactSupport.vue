<script setup lang="ts">
interface Props {
  query?: string
}

const props = withDefaults(defineProps<Props>(), {
  query: '',
})

const { isModalVisible } = useChatWoot()

const toggleChatSupport = () => {
  if (!isModalVisible.value && !ncIsFunction(window.$chatwoot?.toggle)) {
    return
  }

  // Set pre-fill message if query is provided
  if (props.query && window.$chatwoot) {
    window.$chatwoot.setConversationCustomAttributes?.({
      initial_query: props.query,
    })
  }

  const toggleText = (isModalVisible.value ? 'hide' : 'show') as any
  window.$chatwoot.toggle(toggleText)
}
</script>

<template>
  <NcButton
    v-e="['c:chat:contact-support']"
    type="secondary"
    size="small"
    class="nc-contact-support-btn"
    @click="toggleChatSupport"
  >
    <div class="flex items-center gap-1.5">
      <GeneralIcon icon="ncSupportAgent" class="!w-3.5 !h-3.5" />
      <span>Contact Support</span>
    </div>
  </NcButton>
</template>

<style lang="scss" scoped>
.nc-contact-support-btn {
  display: inline-flex;
  vertical-align: middle;
  margin: 2px 0;
}
</style>
