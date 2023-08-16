<script lang="ts" setup>
import { ViewTypes } from 'nocodb-sdk'
import { iconMap, useNuxtApp, useSmartsheetStoreOrThrow, viewIcons } from '#imports'

const emits = defineEmits<Emits>()

interface Emits {
  (event: 'openModal', data: { type: ViewTypes; title?: string }): void
}

const { $e } = useNuxtApp()

const { isSqlView } = useSmartsheetStoreOrThrow()

const { betaFeatureToggleState } = useBetaFeatureToggle()

function onOpenModal(type: ViewTypes, title = '') {
  $e('c:view:create', { view: type })
  emits('openModal', { type, title })
}
</script>

<template>
  <a-menu :selected-keys="[]" class="flex flex-col !text-gray-600 !bg-inherit">
    <div class="px-6 text-xs flex items-center gap-4 my-2 !text-gray-700">
      {{ $t('activity.createView') }}
    </div>

    <a-menu-item
      key="grid"
      class="nc-create-view group !flex !items-center !my-0 !h-2.5rem nc-create-grid-view"
      @click="onOpenModal(ViewTypes.GRID)"
    >
      <a-tooltip :mouse-enter-delay="1" placement="left">
        <template #title>
          {{ $t('msg.info.addView.grid') }}
        </template>

        <div class="!py-0 text-xs flex items-center h-full w-full gap-2">
          <GeneralViewIcon :meta="{ type: ViewTypes.GRID }" class="min-w-5 flex" />

          <div>{{ $t('objects.viewType.grid') }}</div>

          <div class="flex-1" />

          <component :is="iconMap.plus" />
        </div>
      </a-tooltip>
    </a-menu-item>

    <a-menu-item
      key="gallery"
      class="nc-create-view group !flex !items-center !my-0 !h-2.5rem nc-create-gallery-view"
      @click="onOpenModal(ViewTypes.GALLERY)"
    >
      <a-tooltip :mouse-enter-delay="1" placement="left">
        <template #title>
          {{ $t('msg.info.addView.gallery') }}
        </template>

        <div class="!py-0 text-xs flex items-center h-full w-full gap-2">
          <GeneralViewIcon :meta="{ type: ViewTypes.GALLERY }" class="min-w-5 flex" />

          <div>{{ $t('objects.viewType.gallery') }}</div>

          <div class="flex-1" />

          <component :is="iconMap.plus" />
        </div>
      </a-tooltip>
    </a-menu-item>

    <a-menu-item
      v-if="!isSqlView"
      key="form"
      class="nc-create-view group !flex !items-center !my-0 !h-2.5rem nc-create-form-view"
      @click="onOpenModal(ViewTypes.FORM)"
    >
      <a-tooltip :mouse-enter-delay="1" placement="left">
        <template #title>
          {{ $t('msg.info.addView.form') }}
        </template>

        <div class="!py-0 text-xs flex items-center h-full w-full gap-2">
          <GeneralViewIcon :meta="{ type: ViewTypes.FORM }" class="min-w-5 flex" />

          <div>{{ $t('objects.viewType.form') }}</div>

          <div class="flex-1" />

          <component :is="iconMap.plus" />
        </div>
      </a-tooltip>
    </a-menu-item>

    <a-menu-item
      key="kanban"
      class="nc-create-view group !flex !items-center !my-0 !h-2.5rem nc-create-kanban-view"
      @click="onOpenModal(ViewTypes.KANBAN)"
    >
      <a-tooltip :mouse-enter-delay="1" placement="left">
        <template #title>
          {{ $t('msg.info.addView.kanban') }}
        </template>

        <div class="!py-0 text-xs flex items-center h-full w-full gap-2">
          <GeneralViewIcon :meta="{ type: ViewTypes.KANBAN }" class="min-w-5 flex" />

          <div>{{ $t('objects.viewType.kanban') }}</div>

          <div class="flex-1" />

          <component :is="iconMap.plus" />
        </div>
      </a-tooltip>
    </a-menu-item>
    <a-menu-item
      v-if="betaFeatureToggleState.show"
      key="map"
      class="nc-create-view group !flex !items-center !my-0 !h-2.5rem nc-create-map-view"
      @click="onOpenModal(ViewTypes.MAP)"
    >
      <a-tooltip :mouse-enter-delay="1" placement="left">
        <template #title>
          {{ $t('msg.info.addView.map') }}
        </template>

        <div class="!py-0 text-xs flex items-center h-full w-full gap-2">
          <component :is="viewIcons[ViewTypes.MAP].icon" :style="{ color: viewIcons[ViewTypes.MAP]?.color }" />

          <div>{{ $t('objects.viewType.map') }}</div>

          <div class="flex-1" />

          <component :is="iconMap.plus" />
        </div>
      </a-tooltip>
    </a-menu-item>

    <div class="w-full h-3" />
  </a-menu>
</template>

<style lang="scss" scoped>
:deep(.nc-create-view) {
  @apply !py-0 !h-8 mx-3.75 rounded-md hover:(text-gray-800 bg-gray-100);
}
:deep(.nc-create-view.ant-menu-item) {
  @apply px-2.25;
}
</style>
