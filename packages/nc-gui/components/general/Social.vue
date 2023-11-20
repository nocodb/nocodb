<script lang="ts" setup>
import { iconMap, useI18n } from '#imports'

const { locale } = useI18n()

const open = (url: string) => {
  window.open(url, '_blank', 'noopener,noreferrer')
}

const isZhLang = computed(() => locale.value.startsWith('zh'))
</script>

<template>
  <general-share
    v-if="isZhLang"
    class="flex justify-center"
    url="https://github.com/nocodb/nocodb"
    :social-medias="['renren', 'douban', 'weibo', 'wechat']"
  />

  <div v-else class="flex justify-between gap-1 w-full px-2">
    <component
      :is="iconMap.discord"
      v-e="['e:community:discord']"
      class="icon text-[#7289DA]"
      @click="open('https://discord.gg/5RgZmkW')"
    />

    <div
      v-e="['e:community:discourse']"
      class="icon flex items-center justify-center min-w-[43px]"
      @click="open('https://community.nocodb.com/')"
    >
      <div class="discourse" />
    </div>

    <component
      :is="iconMap.reddit"
      v-e="['e:community:reddit']"
      class="icon text-[#FF4600]"
      @click="open('https://www.reddit.com/r/NocoDB/')"
    />

    <component
      :is="iconMap.twitter"
      v-e="['e:community:twitter']"
      class="icon text-[#1DA1F2]"
      @click="open('https://twitter.com/NocoDB')"
    />

    <component
      :is="iconMap.calendar"
      v-e="['e:community:book-demo']"
      class="icon text-green-500"
      @click="open('https://calendly.com/nocodb-meeting')"
    />
  </div>
</template>

<style scoped>
.icon {
  @apply cursor-pointer text-3xl rounded-full p-2 bg-gray-100 shadow-md hover:(shadow-lg bg-gray-200);
}

.discourse {
  height: 22px;
  width: 22px;
  background-image: url('assets/img/discourse-icon.png');
  background-size: contain;
  background-repeat: no-repeat;
}

.discourse::before {
  visibility: hidden;
  content: '';
}
</style>
