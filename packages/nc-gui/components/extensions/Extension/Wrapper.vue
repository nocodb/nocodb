<script lang="ts" setup>
const { fullscreen } = useExtensionHelperOrThrow()

const headerRef = ref<HTMLDivElement>()

const { height } = useElementSize(headerRef)
</script>

<template>
  <div>
    <div ref="headerRef">
      <ExtensionsExtensionHeader>
        <template #extra>
          <slot name="headerExtra"></slot>
        </template>
      </ExtensionsExtensionHeader>
    </div>
    <div
      :class="{
        'p-6 max': fullscreen,
        'h-full': !fullscreen,
      }"
      :style="fullscreen ? { height: height ? `calc(100% - ${height}px)` : 'calc(100% - 64px)' } : {}"
    >
      <slot />
    </div>
  </div>
</template>

<style lang="scss" scoped></style>
