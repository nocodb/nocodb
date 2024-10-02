<script setup lang="ts">
import FeedRecents from './Recents/index.vue'
import FeedChangelog from './Changelog/index.vue'
import FeedYoutube from './Youtube/index.vue'
import FeedTwitter from './Twitter/index.vue'
import FeedRoadmap from './Roadmap.vue'
const { activeTab } = useProductFeed()

const tabs: Array<{
  key: string
  icon: keyof typeof iconMap
  title: string
  container: any
}> = [
  {
    key: 'recents',
    icon: 'ncClock',
    title: 'Recents',
    container: FeedRecents,
  },
  {
    key: 'changelog',
    icon: 'ncList',
    title: 'Changelog',
    container: FeedChangelog,
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
  {
    key: 'twitter',
    icon: 'ncTwitter',
    title: 'Twitter',
    container: FeedTwitter,
  },
]
</script>

<template>
  <FeedHeader />

  <FeedSocial v-if="activeTab === 'recents'" class="absolute right-4 top-28" />
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
        <component :is="tab.container" />
      </a-tab-pane>
    </NcTabs>
  </div>
</template>

<style scoped lang="scss"></style>
