<script setup lang="ts">
const socialIcons = [
  {
    name: '@nocodb',
    icon: iconMap.twitter,
    link: 'https://twitter.com/nocodb',
  },
  {
    name: 'NocoDB',
    icon: iconMap.youtube,
    link: 'https://www.youtube.com/@nocodb',
  },
  {
    name: 'NocoDB',
    icon: iconMap.discord,
    link: 'https://discord.nocodb.com',
  },
  {
    name: 'r/NocoDB',
    icon: iconMap.reddit,
    link: 'https://www.reddit.com/r/NocoDB/',
  },
  {
    name: 'Forum',
    icon: iconMap.langNocodbSdk,
    link: 'https://forum.nocodb.com/',
  },
]

const openUrl = (url: string) => {
  window.open(url, '_blank')
}
</script>

<template>
  <div style="width: 232px" class="flex flex-col bg-white border-gray-200 rounded-lg border-1">
    <div class="text-gray-800 font-semibold leading-6 border-b-1 border-gray-200 px-4 py-3">Stay tuned</div>
    <div class="flex flex-col gap-2">
      <div
        v-for="social in socialIcons"
        :key="social.name"
        class="flex items-center cursor-pointer rounded-lg hover:bg-gray-100 py-3 px-4 gap-2 text-gray-800"
        @click="openUrl(social.link)"
      >
        <component :is="social.icon" class="w-5 h-5 stroke-transparent" />
        <span class="font-semibold">{{ social.name }}</span>
      </div>
    </div>
  </div>
</template>
