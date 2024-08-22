<script setup lang="ts">
interface Prop {
  extensionId: string
  error?: any
}

const { extensionId, error } = defineProps<Prop>()

const {
  extensionList,
  extensionsLoaded,
  availableExtensions,
  eventBus,
  getExtensionIcon,
  duplicateExtension,
  showExtensionDetails,
} = useExtensions()

const activeError = ref(error)

const extensionRef = ref<HTMLElement>()

const extensionModalRef = ref<HTMLElement>()

const isMouseDown = ref(false)

const extension = computed(() => {
  const ext = extensionList.value.find((ext) => ext.id === extensionId)
  if (!ext) {
    throw new Error('Extension not found')
  }
  return ext
})

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

const { fullscreen, collapsed } = useProvideExtensionHelper(extension)

const component = ref<any>(null)

const extensionManifest = ref<any>(null)

const extensionMinHeight = computed(() => {
  switch (extension.value.extensionId) {
    case 'nc-data-exporter':
      return 'min-h-[310px] h-[310px]'
    case 'nc-json-exporter':
      return 'min-h-[215px] h-[215px]'
    case 'nc-csv-import':
      return 'min-h-[190px] h-[190px]'
  }
})

const expandExtension = () => {
  if (!collapsed.value) return

  collapsed.value = false
}

onMounted(() => {
  until(extensionsLoaded)
    .toMatch((v) => v)
    .then(() => {
      extensionManifest.value = availableExtensions.value.find((ext) => ext.id === extension.value.extensionId)

      if (!extensionManifest) {
        return
      }

      import(`../../extensions/${extensionManifest.value.entry}/index.vue`).then((mod) => {
        component.value = markRaw(mod.default)
      })
    })
    .catch((err) => {
      if (!extensionManifest.value) {
        activeError.value = 'There was an error loading the extension'
        return
      }
      activeError.value = err
    })
})

// close fullscreen on escape key press
useEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    fullscreen.value = false
  }
})

// close fullscreen on clicking extensionModalRef directly
const closeFullscreen = (e: MouseEvent) => {
  if (e.target === extensionModalRef.value) {
    fullscreen.value = false
  }
}

const handleDuplicateExtension = async (id: string, open: boolean = false) => {
  const duplicatedExt = await duplicateExtension(id)

  if (duplicatedExt?.id && open) {
    fullscreen.value = false
    eventBus.emit(ExtensionsEvents.DUPLICATE, duplicatedExt.id)
  }
}

// #Listeners
eventBus.on((event, payload) => {
  if (event === ExtensionsEvents.DUPLICATE && extension.value.id === payload) {
    setTimeout(() => {
      nextTick(() => {
        extensionRef.value?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      })
    }, 500)
  }
})
</script>

<template>
  <div ref="extensionRef" class="w-full px-4" :data-testid="extension.id">
    <div
      class="extension-wrapper"
      :class="[
        `${!collapsed ? extensionMinHeight : ''}`,
        {
          '!h-auto': collapsed,
          'isOpen': !collapsed,
          'mousedown': isMouseDown,
        },
      ]"
      @mousedown="isMouseDown = true"
      @mouseup="isMouseDown = false"
    >
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
          <NcButton size="xxsmall" type="text" class="nc-extension-drag-handler" @click.stop>
            <GeneralIcon icon="ncDrag" class="flex-none text-gray-500" />
          </NcButton>

          <img
            v-if="extensionManifest"
            :src="getExtensionIcon(extensionManifest.iconUrl)"
            alt="icon"
            class="h-6 w-6 object-contain"
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
            <span class="extension-title" @dblclick.stop="enableEditMode" @click.stop>
              {{ extension.title }}
            </span>
          </NcTooltip>
        </div>
        <div class="extension-header-right" @click.stop>
          <NcButton v-if="!activeError" type="text" size="xxsmall" class="nc-extension-expand-btn" @click="fullscreen = true">
            <GeneralIcon icon="expand" />
          </NcButton>
          <ExtensionsExtensionMenu
            :active-error="activeError"
            @rename="enableEditMode"
            @duplicate="handleDuplicateExtension(extension.id, true)"
            @show-details="showExtensionDetails(extension.extensionId, 'extension')"
            @clear-data="extension.clear()"
            @delete="extension.delete()"
            class="nc-extension-menu"
          />
          <NcButton size="xxsmall" type="text" @click="collapsed = !collapsed">
            <GeneralIcon :icon="collapsed ? 'arrowDown' : 'arrowUp'" class="flex-none" />
          </NcButton>
        </div>
      </div>

      <template v-if="activeError">
        <div
          v-show="!collapsed"
          class="extension-content nc-scrollbar-thin h-[calc(100%_-_50px)] flex items-center justify-center"
          :class="{
            fullscreen: fullscreen,
          }"
        >
          <a-result status="error" title="Extension Error" class="nc-extension-error">
            <template #subTitle>{{ activeError }}</template>
            <template #extra>
              <NcButton size="small" @click="extension.clear()">
                <div class="flex items-center gap-2">
                  <GeneralIcon icon="reload" />
                  Clear Data
                </div>
              </NcButton>
              <NcButton size="small" type="danger" @click="extension.delete()">
                <div class="flex items-center gap-2">
                  <GeneralIcon icon="delete" />
                  Delete
                </div>
              </NcButton>
            </template>
          </a-result>
        </div>
      </template>
      <template v-else>
        <Teleport to="body" :disabled="!fullscreen">
          <div
            ref="extensionModalRef"
            :class="{ 'extension-modal': fullscreen, 'h-[calc(100%_-_50px)]': !fullscreen }"
            @click="closeFullscreen"
          >
            <div :class="{ 'extension-modal-content': fullscreen, 'h-full': !fullscreen }">
              <div v-if="fullscreen" class="flex items-center justify-between cursor-default">
                <div class="flex-1 max-w-[calc(100%_-_96px)] flex items-center gap-2 text-gray-800 font-weight-600">
                  <img
                    v-if="extensionManifest"
                    :src="getExtensionIcon(extensionManifest.iconUrl)"
                    alt="icon"
                    class="flex-none w-6 h-6"
                  />
                  <input
                    v-if="titleEditMode"
                    ref="titleInput"
                    v-model="tempTitle"
                    class="flex-grow leading-1 outline-0 ring-none !text-xl !bg-transparent !font-weight-600"
                    @click.stop
                    @keyup.enter="updateExtensionTitle"
                    @keyup.esc="updateExtensionTitle"
                    @blur="updateExtensionTitle"
                  />
                  <NcTooltip v-else show-on-truncate-only class="extension-title truncate text-xl">
                    <template #title>
                      {{ extension.title }}
                    </template>
                    <span @dblclick="enableEditMode">
                      {{ extension.title }}
                    </span>
                  </NcTooltip>
                </div>
                <div class="flex items-center gap-4">
                  <ExtensionsExtensionMenu
                    :active-error="activeError"
                    :fullscreen="fullscreen"
                    @rename="enableEditMode"
                    @duplicate="handleDuplicateExtension(extension.id, true)"
                    @show-details="showExtensionDetails(extension.extensionId, 'extension')"
                    @clear-data="extension.clear()"
                    @delete="extension.delete()"
                  />
                  <NcButton size="small" type="text" class="flex-none" @click="fullscreen = false">
                    <GeneralIcon icon="close" />
                  </NcButton>
                </div>
              </div>
              <div
                v-show="fullscreen || !collapsed"
                class="extension-content"
                :class="{ 'fullscreen h-[calc(100%-40px)]': fullscreen, 'h-full': !fullscreen }"
              >
                <component :is="component" :key="extension.uiKey" class="h-full" />
              </div>
            </div>
          </div>
        </Teleport>
      </template>
    </div>
  </div>
</template>

<style scoped lang="scss">
.extension-wrapper {
  @apply bg-white rounded-xl w-full border-1 relative;

  &.isOpen {
    resize: vertical;

    &:hover,
    &.mousedown {
      overflow-y: auto;
    }
  }
}

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
    @apply flex items-center gap-2;
  }

  .extension-title {
    @apply font-weight-600;
  }
}

.extension-content {
  @apply rounded-lg;

  &:not(.fullscreen) {
    @apply p-3;
  }
}

.extension-modal {
  @apply absolute top-0 left-0 z-1000 w-full h-full bg-black bg-opacity-50;

  .extension-modal-content {
    @apply bg-white rounded-2xl w-[90%] max-w-[1154px] h-[90vh] mt-[5vh] mx-auto p-6 flex flex-col gap-3;
  }
}

:deep(.nc-extension-error.ant-result) {
  @apply p-0;
  .ant-result-icon {
    @apply mb-3;
    & > span {
      @apply text-[32px];
    }
  }

  .ant-result-title {
    @apply text-base text-gray-800 font-semibold;
  }

  .ant-result-extra {
    @apply mt-3;
  }
}
</style>
