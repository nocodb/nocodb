<script lang="ts" setup>
interface Props {
  isFullscreen?: boolean
}

withDefaults(defineProps<Props>(), {
  isFullscreen: true,
})

const { eventBus, getExtensionAssetsUrl, duplicateExtension, showExtensionDetails } = useExtensions()

const { fullscreen, collapsed, extension, extensionManifest, activeError } = useExtensionHelperOrThrow()

const titleInput = ref<HTMLInputElement | null>(null)

const titleEditMode = ref<boolean>(false)

const tempTitle = ref<string>(extension.value.title)

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
    class="extension-header px-3 py-2"
    :class="{
      'border-b-1 border-gray-200 h-[49px]': !collapsed,
      'collapsed border-transparent h-[48px]': collapsed,
    }"
    @click="expandExtension"
  >
    <div class="extension-header-left max-w-[calc(100%_-_100px)]">
      <!-- Todo: enable later when we support extension reordering -->
      <!-- eslint-disable vue/no-constant-condition -->
      <NcButton size="xs" type="text" class="nc-extension-drag-handler !px-1" @click.stop>
        <GeneralIcon icon="ncDrag" class="flex-none text-gray-500" />
      </NcButton>

      <img
        v-if="extensionManifest"
        :src="getExtensionAssetsUrl(extensionManifest.iconUrl)"
        alt="icon"
        class="h-8 w-8 object-contain"
      />
      <a-input
        v-if="titleEditMode && !fullscreen"
        ref="titleInput"
        v-model:value="tempTitle"
        type="text"
        class="flex-grow !h-8 !px-1 !py-1 !-ml-1 !rounded-lg w-4/5 extension-title"
        @click.stop
        @keyup.enter="updateExtensionTitle"
        @keyup.esc="updateExtensionTitle"
        @blur="updateExtensionTitle"
      >
      </a-input>

      <NcTooltip v-else show-on-truncate-only class="truncate">
        <template #title>
          {{ extension.title }}
        </template>
        <span class="extension-title cursor-pointer" @dblclick.stop="enableEditMode" @click.stop>
          {{ extension.title }}
        </span>
      </NcTooltip>
    </div>
    <div class="extension-header-right" @click.stop>
      <ExtensionsExtensionHeaderMenu
        :active-error="activeError"
        class="nc-extension-menu"
        @rename="enableEditMode"
        @duplicate="handleDuplicateExtension(extension.id, true)"
        @show-details="showExtensionDetails(extension.extensionId, 'extension')"
        @clear-data="extension.clear()"
        @delete="extension.delete()"
      />
      <NcButton v-if="!activeError" type="text" size="xs" class="nc-extension-expand-btn !px-1" @click="fullscreen = true">
        <GeneralIcon icon="ncMaximize2" class="h-3.5 w-3.5" />
      </NcButton>
      <NcButton size="xs" type="text" class="!px-1" @click="collapsed = !collapsed">
        <GeneralIcon :icon="collapsed ? 'arrowDown' : 'arrowUp'" class="flex-none" />
      </NcButton>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.extension-header {
  @apply flex justify-between;

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
