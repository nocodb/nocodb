<template>
  <div class="wrapper">
    <div v-if="_isZh">
      <p class="caption grey--text d-block mb-3 text-center pt-2">
        Please share a word about us
      </p>
      <share-icons
        class="d-flex justify-center mb-2"
        url="https://github.com/nocodb/nocodb"
        :social-medias="['renren','douban','weibo','wechat']"
      />
      <v-divider />
      <div class="text-center caption grey--text mt-3 mb-1">
        Built with Vue JS<br><img src="vue.svg" class="vue-icon mt-1 mb-n1" alt="vue.js" width="30">
      </div>
    </div>
    <template v-else>
      <div class="d-flex justify-end">
        <v-list
          width="100%"
          class="
          flex-shrink-1
          text-left
          elevation-0
          rounded-sm
          community-card
          item
        "
          :class="{ active: true }"
          dense
        >
          <v-list-item dense href="https://discord.gg/5RgZmkW" target="_blank">
            <!-- Get your questions answered -->
            <v-list-item-title>
              <v-icon class="mr-1" small :color="textColors[0]">
                mdi-discord
              </v-icon>
              <span class="caption" :title="$t('labels.community.joinDiscord')" v-t="['community:discord']">{{
                $t('labels.community.joinDiscord')
              }}</span>
            </v-list-item-title>
          </v-list-item>
          <v-list-item dense href="https://twitter.com/NocoDB" target="_blank">
            <!-- Follow NocoDB -->
            <v-list-item-title>
              <v-icon class="mr-1" small :color="textColors[1]">
                mdi-twitter
              </v-icon>
              <span class="caption" title="$t('labels.community.followNocodb')" v-t="['community:twitter']"> {{
                $t('labels.community.followNocodb')
              }}</span>
            </v-list-item-title>
          </v-list-item>
          <v-list-item dense href="https://www.reddit.com/r/NocoDB/" target="_blank">
            <!-- Get your questions answered -->
            <v-list-item-title>
              <v-icon class="mr-1" small color="#ff4600">
                mdi-reddit
              </v-icon>
              <span class="caption" :title="$t('labels.community.joinReddit')" v-t="['community:reddit']">{{
                $t('labels.community.joinReddit')
              }}</span>
            </v-list-item-title>
          </v-list-item>
          <v-list-item
            dense
            target="_blank"
            href="https://calendly.com/nocodb-meeting"
          >
            <!-- Book a Free DEMO -->
            <v-list-item-title>
              <v-icon class="mr-1" small :color="textColors[3]">
                mdi-calendar-month
              </v-icon>
              <span class="caption" :title="$t('labels.community.bookDemo')" v-t="['community:book-demo']">{{
                $t('labels.community.bookDemo')
              }}</span>
            </v-list-item-title>
          </v-list-item>
        </v-list>
      </div>
    </template>
  </div>
</template>

<script>
import ShareIcons from '../../../share-icons'
import SponsorMini from '~/components/sponsorMini'
import colors from '~/mixins/colors'

export default {
  name: 'Extras',
  components: { ShareIcons },
  mixins: [colors],
  data: () => ({
    showCommunity: true
  }),
  computed: {
  },
  mounted() {
    setInterval(() => {
      this.showCommunity = !this.showCommunity
    }, 60000)
  }
}
</script>

<style scoped lang="scss">
.wrapper {
  position: relative;

  .item {
    z-index: -1;
    opacity: 0;
    position: absolute;
    transition: .6s opacity;
    bottom: 0;
    right: 0;
    width: 100%;

    &.active {
      z-index: 1;
      position: relative;
      opacity: 1;
    }
  }
}

//
//@keyframes anim {
//  0%, 100% {
//    opacity: .2;
//    transform: scale(.5);
//  }
//  50% {
//    opacity: 1;
//    transform: scale(1);
//  }
//}
//
//.vue-icon {
//  animation: anim 2s infinite;
//}
</style>
