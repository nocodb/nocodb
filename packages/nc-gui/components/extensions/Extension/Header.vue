<script lang="ts" setup>
/**
 * ExtensionHeader component.
 *
 * @slot prefix - Slot for custom content to be displayed at the start of the header when in fullscreen mode.
 * @slot extra - Slot for additional custom content to be displayed before the options and close button in fullscreen mode.
 */

interface Props {
  isFullscreen?: boolean
}

withDefaults(defineProps<Props>(), {
  isFullscreen: true,
})

const { eventBus, getExtensionAssetsUrl, duplicateExtension, showExtensionDetails } = useExtensions()

const { fullscreen, collapsed, extension, extensionManifest, activeError, showExpandBtn } = useExtensionHelperOrThrow()

const titleInput = ref<HTMLInputElement | null>(null)

const titleEditMode = ref<boolean>(false)

const tempTitle = ref<string>(extension.value.title)

const showExpandButton = computed(() => {
  return showExpandBtn.value && !activeError.value
})

const enableEditMode = () => {
  titleEditMode.value = true
  tempTitle.value = extension.value.title
  nextTick(() => {
    titleInput.value?.focus()
    titleInput.value?.select()
  })
}

const updateExtensionTitle = async () => {
  await extension.value.setTitle(tempTitle.value)
  titleEditMode.value = false
}

const expandExtension = () => {
  if (!collapsed.value) return

  collapsed.value = false
}
/**
 * Handles the duplication of an extension.
 *
 * @param id - The ID of the extension to duplicate.
 * @param open - Optional. If true, the duplicated extension will be opened.
 */

const handleDuplicateExtension = async (id: string, open: boolean = false) => {
  const duplicatedExt = await duplicateExtension(id)

  if (duplicatedExt?.id && open) {
    fullscreen.value = false
    eventBus.emit(ExtensionsEvents.DUPLICATE, duplicatedExt.id)
  }
}
</script>

<template>
  <div
    v-if="(isFullscreen && fullscreen) || !isFullscreen"
    class="extension-header flex items-center"
    :class="{
      'border-b-1 border-nc-gray-medium h-[49px]': !collapsed && !isFullscreen,
      'collapsed border-transparent h-[48px]': collapsed && !isFullscreen,
      'px-3 py-2 gap-1': !isFullscreen,
      'gap-3 px-4 pt-4 pb-[15px] border-b-1 border-nc-gray-medium': isFullscreen,
    }"
    @click="expandExtension"
  >
    <slot v-if="isFullscreen" name="prefix"></slot>
    <NcButton v-if="!isFullscreen" size="xs" type="text" class="nc-extension-drag-handler !px-1" @click.stop>
      <GeneralIcon icon="ncDrag" class="flex-none text-gray-500" />
    </NcButton>

    <img
      v-if="extensionManifest"
      :src="getExtensionAssetsUrl(extensionManifest.iconUrl)"
      alt="icon"
      class="h-8 w-8 object-contain flex-none"
      :class="{
        'mx-1': !isFullscreen,
      }"
    />
    <div
      v-if="titleEditMode"
      class="flex-1"
      :class="{
        'mr-1': !isFullscreen,
      }"
    >
      <a-input
        ref="titleInput"
        v-model:value="tempTitle"
        type="text"
        class="!h-8 !px-1 !py-1 !-ml-1 !rounded-lg extension-title"
        :class="{
          'w-4/5': !isFullscreen,
          '!text-lg !font-semibold max-w-[420px]': isFullscreen,
        }"
        @click.stop
        @keyup.enter="updateExtensionTitle"
        @keyup.esc="updateExtensionTitle"
        @blur="updateExtensionTitle"
      >
      </a-input>
    </div>

    <NcTooltip v-else show-on-truncate-only class="truncate flex-1">
      <template #title>
        {{ extension.title }}
      </template>
      <span
        class="extension-title cursor-pointer"
        :class="{
          'text-lg font-semibold ': isFullscreen,
          'mr-1': !isFullscreen,
        }"
        @dblclick.stop="enableEditMode"
        @click.stop
      >
        {{ extension.title }}
      </span>
    </NcTooltip>
    <slot v-if="isFullscreen" name="extra"></slot>
    <ExtensionsExtensionHeaderMenu
      :is-fullscreen="isFullscreen"
      class="nc-extension-menu"
      @rename="enableEditMode"
      @duplicate="handleDuplicateExtension(extension.id, true)"
      @show-details="showExtensionDetails(extension.extensionId, 'extension')"
      @clear-data="extension.clear()"
      @delete="extension.delete()"
    />

    <template v-if="!isFullscreen">
      <NcButton
        v-if="showExpandButton"
        size="xs"
        type="text"
        class="nc-extension-expand-btn !px-1"
        @click.stop="fullscreen = true"
      >
        <GeneralIcon icon="ncMaximize2" class="h-3.5 w-3.5" />
      </NcButton>
      <NcButton size="xs" type="text" class="!px-1" @click.stop="collapsed = !collapsed">
        <GeneralIcon :icon="collapsed ? 'arrowDown' : 'arrowUp'" class="flex-none" />
      </NcButton>
    </template>
    <NcButton v-else :size="isFullscreen ? 'small' : 'xs'" type="text" class="flex-none !px-1" @click="fullscreen = false">
      <GeneralIcon icon="close" />
    </NcButton>
  </div>
</template>

<style lang="scss" scoped>
.extension-header {
  &.collapsed:not(:hover) {
    .nc-extension-expand-btn,
    .nc-extension-menu {
      @apply hidden;
    }
  }

  .extension-header-left {
    @apply flex-1 flex items-center gap-2;
  }

  .extension-header-right {
    @apply flex items-center gap-1;
  }

  .extension-title {
    @apply font-weight-600;
  }
}
</style>
