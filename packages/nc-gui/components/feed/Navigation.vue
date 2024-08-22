<script setup lang="ts">
const props = defineProps<{
  activeKey: string
}>()

const emits = defineEmits(['update:activeKey'])

const activeKey = useVModel(props, 'activeKey', emits)

const { $e } = useNuxtApp()

const navigationElements = [
  {
    key: 'recents',
    icon: iconMap.clock,
    title: 'Recents',
    description: 'Recent activities',
  },
  {
    key: 'changelog',
    icon: iconMap.list,
    title: 'Changelog',
    description: 'Recent changes',
  },
  {
    key: 'youtube',
    icon: iconMap.youtube,
    title: 'Youtube',
    description: 'Recent changes',
  },
  {
    key: 'roadmap',
    icon: iconMap.ncNavigation,
    title: 'Roadmap',
    description: 'Upcoming features',
  },
]

const socialLinks = [
  {
    key: 'youtube',
    icon: iconMap.youtube,
    title: 'NocoDB',
    url: 'https://www.youtube.com/@nocodb',
  },
  {
    key: 'twitter',
    icon: iconMap.twitter,
    title: '@nocodb',
    url: 'https://x.com/nocodb',
  },
  {
    key: 'discord',
    icon: iconMap.discord,
    title: 'NocoDB',
    url: 'https://discord.gg/5RgZmkW',
  },
  {
    key: 'reddit',
    icon: iconMap.reddit,
    title: 'r/NocoDB',
    url: 'https://www.reddit.com/r/NocoDB',
  },
]

const openLink = (url: string, key: string) => {
  $e(`c:nocodb:${key}`)
  window.open(url, '_blank')
}
</script>

<template>
  <div style="height: calc(100% - var(--topbar-height))" class="w-80 p-3 flex flex-col justify-between">
    <div class="flex flex-col gap-1">
      <div
        v-for="elem in navigationElements"
        :key="elem.title"
        :class="{
          'bg-[#F0F3FF]': activeKey === elem.key,
          'hover:bg-gray-100': activeKey !== elem.key,
        }"
        class="flex items-center rounded-lg cursor-pointer transition-all gap-2 p-2"
        @click="activeKey = elem.key"
      >
        <div
          :class="{
            '!bg-transparent': activeKey === elem.key,
          }"
          class="bg-gray-200 rounded-md h-6 flex items-center justify-center w-6"
        >
          <component
            :is="elem.icon"
            :class="{
              'text-[#2952CC]': activeKey === elem.key,
            }"
            class="text-gray-700 w-4 h-4"
          />
        </div>
        <div class="flex gap-1 flex-col">
          <div
            :class="{
              'text-[#2952CC]': activeKey === elem.key,
              'text-gray-800': activeKey !== elem.key,
            }"
            class="font-semibold"
          >
            {{ elem.title }}
          </div>

          <div class="text-xs text-gray-500">
            {{ elem.description }}
          </div>
        </div>
      </div>
    </div>
    <div class="flex flex-col gap-1">
      <div
        v-for="social in socialLinks"
        :key="social.key"
        class="flex items-center w-full cursor-pointer transition-all gap-2 px-3 py-2"
        @click="openLink(social.url, social.key)"
      >
        <component :is="social.icon" class="w-5 h-5 stroke-transparent" />
        <span class="text-[13px] text-gray-800 font-medium">
          {{ social.title }}
        </span>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss"></style>
