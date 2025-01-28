<script lang="ts" setup>
/**
 * ExtensionHeaderWrapper component.
 *
 * @slot headerPrefix - Slot for custom content to be displayed at the start of the header when in fullscreen mode.
 * @slot headerExtra - Slot for additional custom content to be displayed in the header when in fullscreen mode.
 */

defineEmits(['headerClick'])

const { fullscreen } = useExtensionHelperOrThrow()

const headerRef = ref<HTMLDivElement>()

const { height } = useElementSize(headerRef)
</script>

<template>
  <div class="h-full">
    <div ref="headerRef" class="extension-header-wrapper" @click="$emit('headerClick')">
      <ExtensionsExtensionHeader>
        <template #prefix>
          <slot name="headerPrefix"></slot>
        </template>
        <template #extra>
          <slot name="headerExtra"></slot>
        </template>
      </ExtensionsExtensionHeader>
    </div>
    <div
      class="extension-content-container"
      :class="{
        'fullscreen nc-scrollbar-thin': fullscreen,
        'h-full': !fullscreen,
      }"
      :style="fullscreen ? { height: height ? `calc(100% - ${height}px)` : 'calc(100% - 64px)' } : {}"
    >
      <slot />
    </div>
  </div>
</template>

<style lang="scss" scoped></style>
