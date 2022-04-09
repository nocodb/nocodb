<template>
  <div class="nc-community-list-container d-flex flex-wrap mx-auto justify-center">
    <div
      v-for="item in items"
      :key="item.icon"
      class="community-item d-flex align-center  flex-column text-center pointer"
    >
      <div
        v-t="[item.t]"
        v-ripple
        class="community-item-thumbnail d-flex align-center justify-center elevation-0 "
        @click="openLink(item.url)"
      >
        <v-icon large :color="item.color">
          {{ item.icon }}
        </v-icon>
      </div>
      <span class="caption" v-html="item.caption" />
    </div>
  </div>
</template>

<script>
import colors from '~/mixins/colors'

export default {
  name: 'CommunityCards',
  mixins: [colors],
  computed: {
    items() {
      return [{
        icon: 'mdi-discord',
        color: this.textColors[0],
        caption: this.$t('labels.community.joinDiscord').split(' ').join('<br/>'),
        url: 'https://discord.gg/5RgZmkW',
        t: 'community:discord'
      }, {
        icon: 'mdi-twitter',
        color: this.textColors[1],
        caption: this.$t('labels.community.followNocodb').split(' ').join('<br/>'),
        url: 'https://twitter.com/NocoDB',
        t: 'community:twitter'
      }, {
        icon: 'mdi-reddit',
        color: '#ff4600',
        caption: this.$t('labels.community.joinReddit').split(' ').join('<br/>'),
        url: 'https://www.reddit.com/r/NocoDB/',
        t: 'community:reddit'
      }, {
        icon: 'mdi-calendar-month',
        color: this.textColors[3],
        caption: this.$t('labels.community.bookDemo'),
        url: 'https://calendly.com/nocodb-meeting',
        t: 'community:book-demo'
      }, {
        icon: 'mdi-file-document-outline',
        color: 'blue',
        caption: 'NocoDB<br/>Docs', // todo :this.$t('labels.community.documentation'),
        url: 'https://docs.nocodb.com/',
        t: 'community:docs'
      }, {
        icon: 'mdi-heart-outline',
        color: 'red',
        caption: 'Sponsor<br/>Us', // todo: this.$t('labels.community.sponsor'),
        url: 'https://github.com/sponsors/nocodb',
        t: 'community:sponsor'
      }]
    }
  }
}
</script>

<style scoped>
.nc-community-list-container {
  gap: 10px;
}

.community-item {
  width: 100px;
  border-radius: 4px;
}

.community-item-thumbnail {
  width: 70px;
  height: 70px;
  border-radius: 4px;
  /*filter: grayscale(1);*/
  transition: .2s filter;
}

.community-item:hover .community-item-thumbnail{
  background-image: linear-gradient(#6661, #6661);
  filter: grayscale(0);
}

</style>
