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
  getExtensionAssetsUrl,
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

const { height } = useElementSize(extensionRef)

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

const extensionManifest = ref<ExtensionManifest | undefined>()

const extensionHeight = computed(() => {
  const heigthInInt = parseInt(extensionManifest.value?.config?.contentMinHeight || '') || undefined

  if (!heigthInInt || height.value > heigthInInt) return `${height.value}px`

  return extensionManifest.value?.config?.contentMinHeight
})

const fullscreenModalMaxWidth = computed(() => {
  const modalMaxWidth = {
    xs: 'min(calc(100vw - 32px), 448px)',
    sm: 'min(calc(100vw - 32px), 640px)',
    md: 'min(calc(100vw - 48px), 900px)',
    lg: 'min(calc(100vw - 48px), 1280px)',
  }

  return extensionManifest.value?.config?.modalMaxWith
    ? modalMaxWidth[extensionManifest.value?.config?.modalMaxWith] || modalMaxWidth.lg
    : modalMaxWidth.lg
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

      if (!extensionManifest.value) {
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
  // Check if the event target or its closest parent is an input, select, or textarea
  const isFormElement = (e?.target as HTMLElement)?.closest('input, select, textarea')

  // If the target is not a form element and the key is 'Escape', close fullscreen
  if (e.key === 'Escape' && !isFormElement) {
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
        {
          '!h-auto': collapsed,
          'isOpen': !collapsed,
          'mousedown': isMouseDown,
        },
      ]"
      :style="
        !collapsed
          ? {
              height: extensionHeight,
              minHeight: extensionManifest?.config?.contentMinHeight,
            }
          : {}
      "
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
          <ExtensionsExtensionMenu
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

      <template v-if="activeError">
        <div
          v-show="!collapsed"
          class="extension-content nc-scrollbar-thin h-[calc(100%_-_50px)] flex items-center justify-center"
          :class="{
            fullscreen,
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
            <div
              :class="{ 'extension-modal-content': fullscreen, 'h-full': !fullscreen }"
              :style="
                fullscreen
                  ? {
                      maxWidth: fullscreenModalMaxWidth,
                    }
                  : {}
              "
            >
              <div v-if="fullscreen" class="flex items-center justify-between cursor-default">
                <div class="flex-1 max-w-[calc(100%_-_96px)] flex items-center gap-2 text-gray-800 font-semibold">
                  <img
                    v-if="extensionManifest"
                    :src="getExtensionAssetsUrl(extensionManifest.iconUrl)"
                    alt="icon"
                    class="flex-none w-8 h-8"
                  />

                  <a-input
                    v-if="titleEditMode"
                    ref="titleInput"
                    v-model:value="tempTitle"
                    type="text"
                    class="flex-grow !h-8 !px-1 !py-1 !-ml-1 !rounded-lg !text-lg font-semibold extension-title max-w-[420px]"
                    @click.stop
                    @keyup.enter.stop="updateExtensionTitle"
                    @keyup.esc.stop="updateExtensionTitle"
                    @blur="updateExtensionTitle"
                  >
                  </a-input>
                  <NcTooltip v-else show-on-truncate-only class="extension-title truncate text-lg">
                    <template #title>
                      {{ extension.title }}
                    </template>
                    <span class="cursor-pointer" @dblclick="enableEditMode">
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
    @apply flex items-center gap-1;
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
    @apply bg-white rounded-2xl w-[90%] h-[90vh] mt-[5vh] mx-auto p-6 flex flex-col gap-3;
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
