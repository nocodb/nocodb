<template>
  <div class="px-2">
    <v-chip x-small> Clicks : {{ clickCount }} </v-chip>
    <v-chip x-small> Keystrokes : {{ keystrokeCount }} </v-chip>
    <v-chip x-small>
      {{ (timer / 1000).toFixed(1) }}
    </v-chip>
    <v-icon v-if="!pause" small @click="pause = true"> mdi-pause-circle-outline </v-icon>
    <v-icon v-else small @click="pause = false"> mdi-play-circle-outline </v-icon>
    <v-icon small @click="reset"> mdi-close-circle-outline </v-icon>
  </div>
</template>

<script>
export default {
  name: 'BetterUX',
  data() {
    return {
      pause: false,
      clickCount: 0,
      keystrokeCount: 0,
      timer: 0,
      interval: null,
    };
  },
  created() {
    this.interval = setInterval(() => {
      if (!this.pause) {
        this.timer += 100;
      }
    }, 100);
    document.addEventListener('click', this.onClick, true);
    document.addEventListener('contextmenu', this.onClick, true);
    document.addEventListener('keypress', this.onKeypress, true);
  },
  beforeDestroy() {
    clearInterval(this.interval);
    document.removeEventListener('click', this.onClick, true);
    document.removeEventListener('contextmenu', this.onClick, true);
    document.removeEventListener('keypress', this.onKeypress, true);
  },
  methods: {
    reset() {
      this.clickCount = 0;
      this.keystrokeCount = 0;
      this.timer = 0;
    },
    onClick() {
      if (!this.pause) {
        this.clickCount++;
      }
    },
    onKeypress() {
      if (!this.pause) {
        this.keystrokeCount++;
      }
    },
  },
};
</script>

<style scoped></style>
