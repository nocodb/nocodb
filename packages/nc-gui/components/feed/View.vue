<script setup lang="ts">
import FeedRecents from './Recents/index.vue'
import FeedChangelog from './Changelog/index.vue'
import FeedYoutube from './Youtube/index.vue'
// import FeedTwitter from './Twitter.vue'
// import FeedRoadmap from './Roadmap.vue'
const { activeTab } = useProductFeed()

const { $e } = useNuxtApp()

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
    key: 'cloud',
    icon: 'ncCloud',
    title: 'Cloud Changelog',
    container: FeedChangelog,
  },
  {
    key: 'github',
    icon: 'ncList',
    title: 'Changelog',
    container: FeedChangelog,
  },
  /*  {
    key: 'roadmap',
    icon: 'ncMapPin',
    title: 'Roadmap',
    container: FeedRoadmap,
  }, */
  {
    key: 'youtube',
    icon: 'ncYoutube',
    title: 'Youtube',
    container: FeedYoutube,
  },
  /*  {
    key: 'twitter',
    icon: 'ncTwitter',
    title: 'Twitter',
    container: FeedTwitter,
  }, */
]

const router = useRouter()

watch(activeTab, (val) => {
  $e(`c:nocodb:feed:${val}`)
  router.push({ query: { tab: val } })
})

onMounted(() => {
  const tab = router.currentRoute.value.query.tab as string
  if (tab && tabs.some((t) => t.key === tab)) {
    activeTab.value = tab
  }
})
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
        <div class="relative">
          <FeedSocial
            :class="{
              'normal-left': ['recents', 'youtube', 'cloud'].includes(tab.key),
              'changelog-left': tab.key === 'github',
              'changelog-twitter': tab.key === 'twitter',
            }"
            class="absolute social-card"
          />
          <component :is="tab.container" :type="tab.key" />
        </div>
      </a-tab-pane>
    </NcTabs>
  </div>
</template>

<style scoped lang="scss">
.social-card {
  top: 24px;
}

.normal-left {
  @apply xl:left-[calc(50%+350px)] left-[calc(50%+300px)];
}

.changelog-left {
  @apply xl:left-[calc(50%+350px)] left-[calc(50%+300px)];
}

.changelog-twitter {
  left: calc(50% + 350px);
}
</style>
