<script lang="ts" setup>
const { fullscreen } = useExtensionHelperOrThrow()

const headerRef = ref<HTMLDivElement>()

const { height } = useElementSize(headerRef)
</script>

<template>
  <div class="h-full">
    <div ref="headerRef" class="extension-header-wrapper">
      <ExtensionsExtensionHeader>
        <template #extra>
          <slot name="headerExtra"></slot>
        </template>
      </ExtensionsExtensionHeader>
    </div>
    <div
      class="extension-content-container"
      :class="{
        'fullscreen p-6': fullscreen,
        'h-full': !fullscreen,
      }"
      :style="fullscreen ? { height: height ? `calc(100% - ${height}px)` : 'calc(100% - 64px)' } : {}"
    >
      <slot />
    </div>
  </div>
</template>

<style lang="scss" scoped></style>
