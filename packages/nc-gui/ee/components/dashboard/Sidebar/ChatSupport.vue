<script setup lang="ts">

const {isModalVisible, toggle} = useChatWoot()

const toggleVisibility = () => {
  toggle(isModalVisible.value ? 'close' : 'open')
}
</script>

<template>
   <div
    v-e="['c:nocodb:chat-support']"
    class="nc-mini-sidebar-btn-full-width"
    data-testid="nc-sidebar-chat-support"
  >
    <div
      class="nc-mini-sidebar-btn relative"
      :class="{
        active: isModalVisible,
      }"
      @click="toggleVisibility"
    >
      <GeneralIcon icon="ncMessageCircleFilled" class="h-4 w-4" />
    </div>
  </div>
</template>