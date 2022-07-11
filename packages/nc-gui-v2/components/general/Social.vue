<script lang="ts" setup>
import { useI18n } from 'vue-i18n'
import { useColors } from '#imports'
import MdiDiscord from '~icons/mdi/discord'
import MdiReddit from '~icons/mdi/reddit'
import MdiTwitter from '~icons/mdi/twitter'
import MdiCalendarMonth from '~icons/mdi/calendar-month'
import BxBxlDiscourse from '~icons/bx/bxl-discourse'

const { locale } = useI18n()
const { colors } = useColors()

const open = (url: string) => {
  window.open(url, '_blank')
}

const isZhLang = $computed(() => locale.value.startsWith('zh'))
</script>

<template>
  <div class="wrapper">
    <div v-if="isZhLang">
      <p class="caption grey--text block mb-3 text-center pt-2">Please share a word about us</p>
      <general-share
        class="flex justify-center mb-2"
        url="https://github.com/nocodb/nocodb"
        :social-medias="['renren', 'douban', 'weibo', 'wechat']"
      />

      <v-divider />

      <div class="text-center caption grey--text mt-3 mb-1">
        Built with Vue JS<br /><img src="vue.svg" class="vue-icon mt-1 mb-n1" alt="vue.js" width="30" />
      </div>
    </div>

    <template v-else>
      <div class="flex justify-end">
        <v-list width="100%" class="py-0 flex-shrink-1 text-left elevation-0 rounded-sm community-card item active" dense>
          <v-list-item>
            <div class="flex justify-space-between d-100 pr-2">
              <MdiDiscord v-t="['e:community:discord']" class="icon text-[#7289DA]" @click="open('https://discord.gg/5RgZmkW')" />
              <div
                v-t="['e:community:discourse']"
                class="icon flex items-center justify-center min-w-[43px]"
                @click="open('https://community.nocodb.com/')"
              >
                <div class="discourse" />
              </div>
              <MdiReddit
                v-t="['e:community:reddit']"
                class="icon text-[#FF4600]"
                @click="open('https://www.reddit.com/r/NocoDB/')"
              />
              <MdiTwitter v-t="['e:community:twitter']" class="icon text-[#1DA1F2]" @click="open('https://twitter.com/NocoDB')" />
              <MdiCalendarMonth
                v-t="['e:community:book-demo']"
                class="icon text-green-500"
                @click="open('https://calendly.com/nocodb-meeting')"
              />
            </div>
          </v-list-item>
        </v-list>
      </div>
    </template>
  </div>
</template>

<style scoped>
.icon {
  @apply cursor-pointer text-4xl rounded-full p-2 bg-gray-100 shadow-md hover:(shadow-lg bg-gray-200) transition-color ease-in duration-100;
}

.discourse {
  height: 22px;
  width: 22px;
  background-image: url('~/assets/img/discourse-icon.png');
  background-size: contain;
  background-repeat: no-repeat;
}

.discourse::before {
  visibility: hidden;
  content: '';
}
</style>
