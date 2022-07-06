<template>
  <div class="wrapper">
    <div v-if="_isZh">
      <p class="caption grey--text d-block mb-3 text-center pt-2">Please share a word about us</p>
      <share-icons
        class="d-flex justify-center mb-2"
        url="https://github.com/nocodb/nocodb"
        :social-medias="['renren', 'douban', 'weibo', 'wechat']"
      />
      <v-divider />
      <div class="text-center caption grey--text mt-3 mb-1">
        Built with Vue JS<br /><img src="vue.svg" class="vue-icon mt-1 mb-n1" alt="vue.js" width="30" />
      </div>
    </div>
    <template v-else>
      <div class="d-flex justify-end">
        <v-list
          width="100%"
          class="py-0 flex-shrink-1 text-left elevation-0 rounded-sm community-card item"
          :class="{ active: true }"
          dense
        >
          <v-list-item>
            <div class="d-flex justify-space-between d-100 pr-2">
              <v-icon
                v-t="['e:community:discord']"
                size="22"
                :color="textColors[0]"
                @click="open('https://discord.gg/5RgZmkW')"
              >
                mdi-discord
              </v-icon>
              <v-icon
                v-t="['e:community:discourse']"
                class="discourse"
                size="22"
                :color="textColors[0]"
                @click="open('https://community.nocodb.com/')"
              >
                mdi-discourse
              </v-icon>
              <v-icon
                v-t="['e:community:reddit']"
                size="22"
                color="#ff4600"
                @click="open('https://www.reddit.com/r/NocoDB/')"
              >
                mdi-reddit
              </v-icon>
              <v-icon
                v-t="['e:community:twitter']"
                size="22"
                :color="textColors[1]"
                @click="open('https://twitter.com/NocoDB')"
              >
                mdi-twitter
              </v-icon>
              <v-icon
                v-t="['e:community:book-demo']"
                size="22"
                :color="textColors[3]"
                @click="open('https://calendly.com/nocodb-meeting')"
              >
                mdi-calendar-month
              </v-icon>
            </div>
          </v-list-item>

          <!--          <v-list-item dense href="https://discord.gg/5RgZmkW" target="_blank">
            &lt;!&ndash; Join Discord &ndash;&gt;
            <v-list-item-title>
              <v-icon class="mr-1" small :color="textColors[0]">
                mdi-discord
              </v-icon>
              <span v-t="['community:discord']" class="caption" :title="$t('labels.community.joinDiscord')">{{
                $t('labels.community.joinDiscord')
              }}</span>
            </v-list-item-title>
          </v-list-item>
          &lt;!&ndash; Join Community &ndash;&gt;
          <v-list-item dense href="https://community.nocodb.com/" target="_blank">
            <v-list-item-title>
              <v-icon class="mr-1 discourse" small :color="textColors[0]">
                mdi-discourse
              </v-icon>
              <span v-t="['community:discourse']" class="caption" :title="$t('labels.community.joinCommunity')">{{
                $t('labels.community.joinCommunity')
              }}</span>
            </v-list-item-title>
          </v-list-item>
          <v-divider />
          <v-list-item dense href="https://twitter.com/NocoDB" target="_blank">
            &lt;!&ndash; Join Reddit &ndash;&gt;
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
            &lt;!&ndash; Follow NocoDB &ndash;&gt;
            <v-list-item-title>
              <v-icon class="mr-1" small :color="textColors[1]">
                mdi-twitter
              </v-icon>
              <span class="caption" title="$t('labels.community.followNocodb')" v-t="['community:twitter']"> {{
                  $t('labels.community.followNocodb')
                }}</span>
            </v-list-item-title>
          </v-list-item>-->
          <!--          <v-list-item dense href="https://www.reddit.com/r/NocoDB/" target="_blank">
            &lt;!&ndash; Book a Free DEMO &ndash;&gt;
            <v-list-item-title>
              <v-icon class="mr-1" small :color="textColors[3]">
                mdi-calendar-month
              </v-icon>
              <span v-t="['community:book-demo']" class="caption" :title="$t('labels.community.bookDemo')">{{
                $t('labels.community.bookDemo')
              }}</span>
            </v-list-item-title>
          </v-list-item>-->
        </v-list>
      </div>
    </template>
  </div>
</template>

<script>
import ShareIcons from '../../../ShareIcons';
import colors from '~/mixins/colors';

export default {
  name: 'Extras',
  components: { ShareIcons },
  mixins: [colors],
  data: () => ({
    showCommunity: true,
  }),
  computed: {},
  mounted() {
    setInterval(() => {
      this.showCommunity = !this.showCommunity;
    }, 60000);
  },
};
</script>

<style scoped lang="scss">
.wrapper {
  position: relative;

  .item {
    z-index: -1;
    opacity: 0;
    position: absolute;
    transition: 0.6s opacity;
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

.v-icon.discourse {
  height: 22px;
  width: 22px;
  background-image: url('~/assets/img/discourse-icon.png');
  background-size: contain;
  background-repeat: no-repeat;
}

.v-icon.discourse::before {
  visibility: hidden;
  content: '';
}
</style>
