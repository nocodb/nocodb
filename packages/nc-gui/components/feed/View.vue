<script setup lang="ts">
import FeedRecents from './Changelog/index.vue'
import FeedYoutube from './Youtube/index.vue'
import FeedRoadmap from './Roadmap.vue'
const { activeTab } = useProductFeed()

const tabs = [
  {
    key: 'recents',
    icon: 'clock',
    title: 'Recents',
    container: FeedRecents,
  },
  {
    key: 'changelog',
    icon: 'list',
    title: 'Changelog',
    container: FeedRecents,
  },
  {
    key: 'roadmap',
    icon: 'ncMapPin',
    title: 'Roadmap',
    container: FeedRoadmap,
  },
  {
    key: 'youtube',
    icon: 'ncYoutube',
    title: 'Youtube',
    container: FeedYoutube,
  },
]
</script>

<template>
  <FeedHeader />
  <div class="flex flex-col h-full">
    <NcTabs v-model:activeKey="activeTab" centered>
      <a-tab-pane v-for="tab in tabs" :key="tab.key" class="bg-gray-50 !h-full">
        <template #tab>
          <div class="flex gap-2 items-center">
            <GeneralIcon
              :class="{
                'text-brand-500': activeTab === tab.key,
                'text-gray-600': activeTab !== tab.key,
              }"
              :icon="tab.icon as any"
            />
            <span
              :class="{
                'text-brand-500 font-medium': activeTab === tab.key,
                'text-gray-700': activeTab !== tab.key,
              }"
              class="text-sm"
              >{{ tab.title }}
            </span>
          </div>
        </template>
        <div
          :style="{
            height:
              activeTab === 'recents'
                ? 'calc(100dvh - var(--toolbar-height) - var(--topbar-height))'
                : 'calc(100dvh - var(--toolbar-height))',
          }"
          class="overflow-y-auto nc-scrollbar-md mx-auto w-full"
        >
          <component :is="tab.container" />
        </div>
      </a-tab-pane>
    </NcTabs>
  </div>
</template>

<style scoped lang="scss"></style>
