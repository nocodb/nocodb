<script setup lang="ts">
import { useUploadState } from './UploadProviders/useUploadState'

interface Props {
  visible: boolean
  enabledProviders?: ('local' | 'url' | 'webcam')[]
}

interface Emits {
  (e: 'update:visible', value: boolean): void
}

const props = withDefaults(defineProps<Props>(), {
  visible: false,
  enabledProviders: () => ['local', 'url', 'webcam'],
})

const emit = defineEmits<Emits>()

const { isMobileMode } = useGlobal()

const dialogShow = useVModel(props, 'visible', emit)

const activeMenu = ref<'local' | 'url' | 'webcam'>('local')

const { clearFiles } = useUploadState()

const selectMenu = (option: 'local' | 'url' | 'webcam') => {
  clearFiles()
  activeMenu.value = option
}

// Set initial active menu based on enabled providers
onMounted(() => {
  if (props.enabledProviders.length > 0) {
    activeMenu.value = props.enabledProviders[0]
  }
})
</script>

<template>
  <NcModal
    v-model:visible="dialogShow"
    :show-separator="false"
    size="medium"
    width="50rem"
    wrap-class-name="nc-modal-file-upload"
    class="!rounded-md"
    @keydown.esc="dialogShow = false"
  >
    <div class="flex h-full" :class="isMobileMode ? 'flex-col' : 'flex-row'">
      <div
        v-if="enabledProviders.length > 1"
        style="border-top-left-radius: 1rem; border-bottom-left-radius: 1rem"
        class="px-2 bg-nc-bg-gray-extralight"
      >
        <NcMenu class="!h-full !bg-nc-bg-gray-extralight flex flex-col" :class="{ '!flex-row overflow-x-scroll': isMobileMode }">
          <NcMenuItem
            v-if="enabledProviders.includes('local')"
            key="local"
            class="!hover:bg-nc-bg-gray-medium !hover:text-nc-content-gray rounded-md"
            :class="{
              'active-menu': activeMenu === 'local',
            }"
            @click="selectMenu('local')"
          >
            <div class="flex gap-2 items-center">
              <GeneralIcon icon="file" />
              {{ $t('title.localFiles') }}
            </div>
          </NcMenuItem>

          <NcMenuItem
            v-if="enabledProviders.includes('url')"
            key="url"
            class="!hover:bg-nc-bg-gray-medium !hover:text-nc-content-gray rounded-md"
            :class="{
              'active-menu': activeMenu === 'url',
            }"
            @click="selectMenu('url')"
          >
            <div class="flex gap-2 items-center">
              <GeneralIcon icon="link2" />
              {{ $t('title.uploadViaUrl') }}
            </div>
          </NcMenuItem>

          <NcMenuItem
            v-if="enabledProviders.includes('webcam')"
            key="webcam"
            class="!hover:bg-nc-bg-gray-medium !hover:text-nc-content-gray rounded-md"
            :class="{
              'active-menu': activeMenu === 'webcam',
            }"
            @click="selectMenu('webcam')"
          >
            <div class="flex gap-2 items-center">
              <GeneralIcon icon="camera" />
              {{ $t('title.webcam') }}
            </div>
          </NcMenuItem>
        </NcMenu>
      </div>

      <div style="height: 425px" class="!w-full flex-grow p-2">
        <NcFileUploadProvidersLocal v-show="activeMenu === 'local'" />

        <NcFileUploadProvidersCamera v-if="activeMenu === 'webcam'" />

        <NcFileUploadProvidersUrl v-if="activeMenu === 'url'" />
      </div>
    </div>
  </NcModal>
</template>

<style lang="scss">
.nc-modal-file-upload {
  .active-menu {
    @apply bg-nc-bg-brand-inverted font-semibold text-nc-content-brand rounded-md;
  }
}

.nc-modal-file-upload {
  .nc-modal {
    @apply !p-0;
  }
}
</style>

<style scoped lang="scss">
:deep(.ant-menu-inline),
:deep(.ant-menu-vertical),
:deep(.ant-menu-vertical-left) {
  border-right: none !important;
}
</style>
