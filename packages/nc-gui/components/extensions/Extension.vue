<script setup lang="ts">
interface Prop {
  extensionId: string
  error?: any
}

const { extensionId, error } = defineProps<Prop>()

const { extensionList, extensionsLoaded, availableExtensions, eventBus } = useExtensions()

const isLoadedExtension = ref<boolean>(true)

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

const extensionManifest = computed<ExtensionManifest | undefined>(() => {
  return availableExtensions.value.find((ext) => ext.id === extension.value?.extensionId)
})

const {
  fullscreen,
  fullscreenModalSize: currentExtensionModalSize,
  collapsed,
} = useProvideExtensionHelper(extension, extensionManifest, activeError)

const { height } = useElementSize(extensionRef)

const component = ref<any>(null)

const extensionHeight = computed(() => {
  const heigthInInt = parseInt(extensionManifest.value?.config?.contentMinHeight || '') || undefined

  if (!heigthInInt || height.value > heigthInInt) return `${height.value}px`

  return extensionManifest.value?.config?.contentMinHeight
})

const fullscreenModalSize = computed(() => {
  return currentExtensionModalSize.value ? modalSizes[currentExtensionModalSize.value] || modalSizes.lg : modalSizes.lg
})

// close fullscreen on clicking extensionModalRef directly
const closeFullscreen = (e: MouseEvent) => {
  if (e.target === extensionModalRef.value) {
    fullscreen.value = false
  }
}

onMounted(() => {
  until(extensionsLoaded)
    .toMatch((v) => v)
    .then(() => {
      if (!extensionManifest.value) {
        return
      }

      import(`../../extensions/${extensionManifest.value.entry}/index.vue`).then((mod) => {
        component.value = markRaw(mod.default)
        isLoadedExtension.value = false
      })
    })
    .catch((err) => {
      if (!extensionManifest.value) {
        activeError.value = 'There was an error loading the extension'
        return
      }
      activeError.value = err
      isLoadedExtension.value = false
    })
})

// #Listeners

// close fullscreen on escape key press
useEventListener('keydown', (e) => {
  // Check if the event target or its closest parent is an input, select, or textarea
  const isFormElement = (e?.target as HTMLElement)?.closest('input, select, textarea')

  // If the target is not a form element and the key is 'Escape', close fullscreen
  if (e.key === 'Escape' && !isFormElement) {
    fullscreen.value = false
  }
})

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
  <div ref="extensionRef" class="w-full px-4" :class="`nc-${extensionManifest?.id}`" :data-testid="extension.id">
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
      <ExtensionsExtensionHeader :is-fullscreen="false" />

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
                      maxWidth: fullscreenModalSize.width,
                      maxHeight: fullscreenModalSize.height,
                    }
                  : {}
              "
            >
              <div
                v-show="fullscreen || !collapsed"
                class="extension-content h-full"
                :class="{ 'fullscreen': fullscreen, 'h-full nc-scrollbar-thin': !fullscreen }"
              >
                <component :is="component" :key="extension.uiKey" class="h-full" />
              </div>
            </div>
          </div>
        </Teleport>
      </template>

      <general-overlay :model-value="isLoadedExtension" inline transition class="!bg-opacity-15 rounded-xl overflow-hidden">
        <div class="flex flex-col items-center justify-center h-full w-full !bg-white !bg-opacity-80">
          <a-spin size="large" />
        </div>
      </general-overlay>
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

.extension-content {
  @apply rounded-lg;

  &:not(.fullscreen) {
    @apply p-3;
  }
}

.extension-modal {
  @apply absolute top-0 left-0 z-1000 w-full h-full bg-black bg-opacity-50 flex items-center justify-center;

  .extension-modal-content {
    @apply bg-white rounded-2xl w-[90%] h-[90vh]  mx-auto flex flex-col;
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
