<script lang="ts" setup>
import { ViewTypes } from 'nocodb-sdk'
import { ref, useNuxtApp } from '#imports'
import { viewIcons } from '~/utils'
import MdiPlusIcon from '~icons/mdi/plus'
import MdiXml from '~icons/mdi/xml'
import MdiHook from '~icons/mdi/hook'
import MdiHeartsCard from '~icons/mdi/cards-heart'
import MdiShieldLockOutline from '~icons/mdi/shield-lock-outline'

interface Emits {
  (event: 'openModal', data: { type: ViewTypes; title?: string }): void
}

const emits = defineEmits<Emits>()

const { $e } = useNuxtApp()

const isView = ref(false)

function onApiSnippet() {
  // get API snippet
  $e('a:view:api-snippet')
}

function onOpenModal(type: ViewTypes, title = '') {
  emits('openModal', { type, title })
}
</script>

<template>
  <a-menu class="flex-1 flex flex-col">
    <a-divider class="my-2" />

    <h3 class="px-3 text-xs font-semibold flex items-center gap-4">
      {{ $t('activity.createView') }}
      <a-tooltip>
        <template #title>
          {{ $t('msg.info.onlyCreator') }}
        </template>
        <MdiShieldLockOutline class="text-pink-500" />
      </a-tooltip>
    </h3>

    <a-menu-item key="grid" class="group !flex !items-center !my-0 !h-[30px]" @click="onOpenModal(ViewTypes.GRID)">
      <a-tooltip placement="left">
        <template #title>
          {{ $t('msg.info.addView.grid') }}
        </template>

        <div class="text-xs flex items-center h-full w-full gap-2">
          <component :is="viewIcons[ViewTypes.GRID].icon" :class="`text-${viewIcons[ViewTypes.GRID].color}`" />

          <div>{{ $t('objects.viewType.grid') }}</div>

          <div class="flex-1" />

          <MdiPlusIcon class="group-hover:text-primary" />
        </div>
      </a-tooltip>
    </a-menu-item>

    <a-menu-item key="gallery" class="group !flex !items-center !-my0 !h-[30px]" @click="onOpenModal(ViewTypes.GALLERY)">
      <a-tooltip placement="left">
        <template #title>
          {{ $t('msg.info.addView.gallery') }}
        </template>

        <div class="text-xs flex items-center h-full w-full gap-2">
          <component :is="viewIcons[ViewTypes.GALLERY].icon" :class="`text-${viewIcons[ViewTypes.GALLERY].color}`" />

          <div>{{ $t('objects.viewType.gallery') }}</div>

          <div class="flex-1" />

          <MdiPlusIcon class="group-hover:text-primary" />
        </div>
      </a-tooltip>
    </a-menu-item>

    <a-menu-item v-if="!isView" key="form" class="group !flex !items-center !my-0 !h-[30px]" @click="onOpenModal(ViewTypes.FORM)">
      <a-tooltip placement="left">
        <template #title>
          {{ $t('msg.info.addView.form') }}
        </template>

        <div class="text-xs flex items-center h-full w-full gap-2">
          <component :is="viewIcons[ViewTypes.FORM].icon" :class="`text-${viewIcons[ViewTypes.FORM].color}`" />

          <div>{{ $t('objects.viewType.form') }}</div>

          <div class="flex-1" />

          <MdiPlusIcon class="group-hover:text-primary" />
        </div>
      </a-tooltip>
    </a-menu-item>

    <div class="flex-auto justify-end flex flex-col gap-4 mt-4">
      <button
        class="flex items-center gap-2 w-full mx-3 px-4 py-3 rounded !bg-primary text-white transform translate-x-4 hover:(translate-x-0 shadow-lg) transition duration-150 ease"
        @click="onApiSnippet"
      >
        <MdiXml />Get API Snippet
      </button>

      <button
        class="flex items-center gap-2 w-full mx-3 px-4 py-3 rounded border transform translate-x-4 hover:(translate-x-0 shadow-lg) transition duration-150 ease"
        @click="onApiSnippet"
      >
        <MdiHook />{{ $t('objects.webhooks') }}
      </button>
    </div>

    <general-flipping-card class="my-4 min-h-[100px] w-[250px]" :triggers="['click', { duration: 15000 }]">
      <template #front>
        <div class="flex h-full w-full gap-6 flex-col">
          <general-social />

          <div>
            <a
              v-t="['e:hiring']"
              class="px-4 py-3 !bg-primary rounded shadow text-white"
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
        <!-- todo: add project cost -->
        <a
          href="https://github.com/sponsors/nocodb"
          target="_blank"
          class="group flex items-center gap-2 w-full mx-3 px-4 py-2 rounded-l !bg-primary text-white transform translate-x-4 hover:(translate-x-0 shadow-lg !opacity-100) transition duration-150 ease"
          @click.stop
        >
          <MdiHeartsCard class="text-red-500" />
          {{ $t('activity.sponsorUs') }}
        </a>
      </template>
    </general-flipping-card>
  </a-menu>
</template>
