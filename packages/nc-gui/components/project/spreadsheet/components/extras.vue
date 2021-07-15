<template>
  <div class="wrapper">


    <div class="d-flex justify-end">
      <v-list
        width="100%"
        class="
          flex-shrink-1
          text-left
          elevation-1
          rounded-sm
          community-card
          item
        "
        :class="{ active: showCommunity }"
        dense
      >
        <v-list-item
          dense
          target="_blank"
          href="https://calendly.com/nocodb"
        >
          <!-- Book a Free DEMO -->
          <v-list-item-title>
            <v-icon class="mr-1" small :color="textColors[3]">mdi-calendar-month
            </v-icon>
            <span class="caption" :title="$t('projects.show_community_message_2')">{{
                $t('projects.show_community_message_2')
              }}</span></v-list-item-title>
        </v-list-item>
        <v-divider></v-divider>
        <v-list-item dense href="https://discord.gg/5RgZmkW" target="_blank">
          <!-- Get your questions answered -->
          <v-list-item-title>
            <v-icon class="mr-1" small :color="textColors[0]">mdi-discord</v-icon>
            <span class="caption" :title="$t('projects.show_community_message_3_short')">{{
                $t('projects.show_community_message_3_short')
              }}</span>
          </v-list-item-title>
        </v-list-item>
        <v-divider></v-divider>
        <v-list-item dense href="https://twitter.com/NocoDB" target="_blank">
          <!-- Follow NocoDB -->
          <v-list-item-title>
            <v-icon class="mr-1" small :color="textColors[1]">mdi-twitter</v-icon>
            <span class="caption" title="$t('projects.show_community_message_4')"> {{
                $t('projects.show_community_message_4')
              }}</span></v-list-item-title>
        </v-list-item>
      </v-list>
    </div>


    <sponsor-mini
      :class="{ active: !showCommunity }" class="item" :nav="true"></sponsor-mini>
  </div>
</template>

<script>
import SponsorMini from "~/components/sponsorMini";
import colors from "~/mixins/colors";

export default {
  name: "extras",
  data: () => ({
    showCommunity: true
  }),
  mixins: [colors],
  components: {SponsorMini},
  mounted() {
    setInterval(() => this.showCommunity = !this.showCommunity, 60000)
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
</style>
