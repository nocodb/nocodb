<script lang="ts" setup>
import { ViewTypes } from 'nocodb-sdk'
import { ref } from '#imports'
import { viewIcons } from '~/utils'

interface Emits {
  (event: 'openModal', data: { type: ViewTypes; title?: string }): void
}

const emits = defineEmits<Emits>()

const { isUIAllowed } = useUIPermission()

const isView = ref(false)

const showWebhookDrawer = ref(false)

function onOpenModal(type: ViewTypes, title = '') {
  emits('openModal', { type, title })
}
</script>

<template>
  <a-menu :selected-keys="[]" class="flex flex-col">
    <div class="flex-1"></div>
    <div v-if="isUIAllowed('virtualViewsCreateOrEdit')">
      <h3 class="px-3 py-1 text-xs font-semibold flex items-center gap-4 text-gray-500">
        {{ $t('activity.createView') }}
      </h3>

      <a-menu-item
        key="grid"
        class="group !flex !items-center !my-0 !h-[30px] nc-create-3-view"
        @click="onOpenModal(ViewTypes.GRID)"
      >
        <a-tooltip :mouse-enter-delay="1" placement="left">
          <template #title>
            {{ $t('msg.info.addView.grid') }}
          </template>

          <div class="text-xs flex items-center h-full w-full gap-2">
            <component :is="viewIcons[ViewTypes.GRID].icon" :style="{ color: viewIcons[ViewTypes.GRID].color }" />

            <div>{{ $t('objects.viewType.grid') }}</div>

            <div class="flex-1" />

            <mdi-plus class="group-hover:text-primary" />
          </div>
        </a-tooltip>
      </a-menu-item>

      <a-menu-item
        key="gallery"
        class="group !flex !items-center !-my0 !h-[30px] nc-create-2-view"
        @click="onOpenModal(ViewTypes.GALLERY)"
      >
        <a-tooltip :mouse-enter-delay="1" placement="left">
          <template #title>
            {{ $t('msg.info.addView.gallery') }}
          </template>

          <div class="text-xs flex items-center h-full w-full gap-2">
            <component :is="viewIcons[ViewTypes.GALLERY].icon" :style="{ color: viewIcons[ViewTypes.GALLERY].color }" />

            <div>{{ $t('objects.viewType.gallery') }}</div>

            <div class="flex-1" />

            <mdi-plus class="group-hover:text-primary" />
          </div>
        </a-tooltip>
      </a-menu-item>

      <a-menu-item
        v-if="!isView"
        key="form"
        class="group !flex !items-center !my-0 !h-[30px] nc-create-1-view"
        @click="onOpenModal(ViewTypes.FORM)"
      >
        <a-tooltip :mouse-enter-delay="1" placement="left">
          <template #title>
            {{ $t('msg.info.addView.form') }}
          </template>

          <div class="text-xs flex items-center h-full w-full gap-2">
            <component :is="viewIcons[ViewTypes.FORM].icon" :style="{ color: viewIcons[ViewTypes.FORM].color }" />

            <div>{{ $t('objects.viewType.form') }}</div>

            <div class="flex-1" />

            <mdi-plus class="group-hover:text-primary" />
          </div>
        </a-tooltip>
      </a-menu-item>

      <div class="w-full h-4"></div>
    </div>

    <!--
       todo: bring back later
       <general-flipping-card class="my-4 lg:my-6 min-h-[100px]" :triggers="['click', { duration: 15000 }]">
      <template #front>
        <div class="flex h-full w-full gap-6 flex-col">
          <general-social />

          <div>
            <a
              v-t="['e:hiring']"
              class="px-4 py-3 rounded border text-xs text-current"
              href="https://angel.co/company/nocodb"
              target="_blank"
              @click.stop
            >
              🚀 We are Hiring! 🚀
            </a>
          </div>
        </div>
      </template>

      <template #back>
        &lt;!&ndash; todo: add project cost &ndash;&gt;
        <a
          href="https://github.com/sponsors/nocodb"
          target="_blank"
          class="group flex items-center gap-2 w-full mx-3 px-4 py-3 rounded-l border transform translate-x-4 hover:(translate-x-0 shadow-lg !opacity-100) transition duration-150 ease !text-xs text-current"
          @click.stop
        >
          <mdi-cards-heart class="text-red-500" />
          {{ $t('activity.sponsorUs') }}
        </a>
      </template>
    </general-flipping-card> -->

    <WebhookDrawer v-if="showWebhookDrawer" v-model="showWebhookDrawer" />
  </a-menu>
</template>
