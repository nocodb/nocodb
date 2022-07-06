<template>
  <div
    class="flip-card"
    :style="{ height, width }"
    @click="handleClick"
    @mouseover="handleHover(true)"
    @mouseleave="handleHover(false)"
  >
    <div class="flipper" :style="{ transform: flipped ? 'rotateY(180deg)' : '' }">
      <div class="front" :style="{ 'pointer-events': flipped ? 'none' : 'auto' }">
        <slot name="front" />
      </div>
      <div class="back" :style="{ 'pointer-events': flipped ? 'auto' : 'none' }">
        <slot name="back" />
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'FlipCard',
  props: {
    width: {
      type: String,
      required: true,
    },
    height: {
      type: String,
      required: true,
    },
    onHover: {
      type: Boolean,
      default: true,
    },
    onClick: {
      type: Boolean,
      default: false,
    },
    onTime: {
      type: Number,
      default: 0,
    },
  },
  data: () => ({
    flipped: false,
    hovered: false,
    flipTimer: null,
  }),
  mounted() {
    if (this.onTime > 0) {
      this.flipTimer = setInterval(() => {
        if (!this.hovered) {
          this.flipped = !this.flipped;
        }
      }, this.onTime);
    }
  },
  unmounted() {
    if (this.flipTimer) {
      clearInterval(this.flipTimer);
    }
  },
  methods: {
    handleHover(val) {
      this.hovered = val;
      if (this.onHover) {
        this.flipped = val;
      }
    },
    handleClick() {
      if (this.onClick) {
        this.flipped = !this.flipped;
      }
    },
  },
};
</script>

<style lang="scss" scoped>
.flip-card {
  background-color: transparent;
  perspective: 1000px;
}

.flipper {
  position: relative;
  width: 100%;
  height: 100%;
  text-align: center;
  transition: transform 0.8s;
  transform-style: preserve-3d;
}

.front,
.back {
  position: absolute;
  width: 100%;
  height: 100%;
  -webkit-backface-visibility: hidden;
  backface-visibility: hidden;
}

.front {
  color: black;
}

.back {
  color: black;
  transform: rotateY(180deg);
}
</style>
