<script setup lang="ts">
const { $e } = useNuxtApp()

const socialIcons = [
  {
    name: '@nocodb',
    icon: iconMap.iconTwitter,
    link: 'https://twitter.com/nocodb',
    e: 'c:nocodb:twitter-open',
  },
  {
    name: 'NocoDB',
    icon: iconMap.youtube,
    e: 'c:nocodb:youtube-open',
    link: 'https://www.youtube.com/@nocodb',
  },
  {
    name: 'NocoDB',
    icon: iconMap.iconDiscord,
    e: 'c:nocodb:discord-open',
    link: 'http://discord.nocodb.com',
  },
  {
    name: 'r/NocoDB',
    icon: iconMap.iconReddit,
    e: 'c:nocodb:reddit-open',
    link: 'https://www.reddit.com/r/NocoDB/',
  },
  {
    name: 'Forum',
    icon: iconMap.nocodb,
    e: 'c:nocodb:forum-open',
    link: 'https://community.nocodb.com/',
  },
]

const openUrl = (url: string, e: string) => {
  $e(e, {
    trigger: 'feed',
  })
  window.open(url, '_blank')
}
</script>

<template>
  <div style="width: 230px" class="flex flex-col bg-white border-gray-200 rounded-lg border-1">
    <div class="text-gray-800 font-semibold leading-6 border-b-1 border-gray-200 px-4 py-3">Stay tuned</div>
    <div class="flex flex-col p-1">
      <div
        v-for="social in socialIcons"
        :key="social.name"
        class="flex items-center social-icon-wrapper cursor-pointer rounded-lg hover:bg-gray-100 py-3 px-4 gap-2 text-gray-800"
        @click="openUrl(social.link, social.e)"
      >
        <component :is="social.icon" class="w-5 h-5 stroke-transparent social-icon" />
        <span class="font-semibold">{{ social.name }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.social-icon {
  // Make icon black and white
  filter: grayscale(100%);

  // Make icon color on hover
  &:hover {
    filter: grayscale(100%) invert(100%);
  }
}

.social-icon-wrapper {
  .nc-icon {
    @apply mr-0.15;
  }

  &:hover {
    .social-icon {
      filter: none !important;
    }
  }
}
</style>
