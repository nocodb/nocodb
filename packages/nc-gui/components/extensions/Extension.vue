<script setup lang="ts">
interface Prop {
  extension?: any
}

const { extension } = defineProps<Prop>()

const collapsed = ref(false)

const component = ref<any>(null)

const { fullScreen } = useProvideExtensionHelper()

onMounted(async () => {
  const mod = await import(`../../extensions/${extension.entry}/index.vue`)
  component.value = markRaw(mod.default)
})
</script>

<template>
  <div class="w-full p-2">
    <div class="extension-wrapper">
      <div class="extension-header">
        <div class="extension-header-left">
          <GeneralIcon icon="drag" />
          <div class="extension-title">{{ extension.title }}</div>
        </div>
        <div class="extension-header-right">
          <GeneralIcon icon="settings" />
          <GeneralIcon icon="expand" @click="fullScreen = true" />
          <GeneralIcon icon="threeDotVertical" />
          <GeneralIcon v-if="collapsed" icon="arrowUp" @click="collapsed = !collapsed" />
          <GeneralIcon v-else icon="arrowDown" @click="collapsed = !collapsed" />
        </div>
      </div>
      <div v-if="!fullScreen" v-show="!collapsed" class="extension-content"><component :is="component" /></div>
      <NcModal
        v-else
        v-model:visible="fullScreen"
        class="extension-fullscreen"
        :body-style="{ 'max-height': '85vh', 'height': '85vh' }"
        :closable="true"
        :footer="null"
        width="90vw"
      >
        <component :is="component" />
      </NcModal>
    </div>
  </div>
</template>

<style lang="scss">
.extension-wrapper {
  @apply bg-white rounded-lg p-2 w-full border-1;
}

.extension-header {
  @apply flex justify-between;

  .extension-header-left {
    @apply flex items-center gap-2;
  }

  .extension-header-right {
    @apply flex items-center gap-4;
  }

  .extension-title {
    @apply font-weight-600;
  }
}

.extension-content {
  @apply border-1 m-2 p-2 rounded-lg;
}
</style>
