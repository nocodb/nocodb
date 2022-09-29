<template>
  <div class="nc-container" :class="{ active: modal }" @click="modal = false">
    <div class="nc-content elevation-3 pa-4" @click.stop>
      <slot />
    </div>
  </div>
</template>

<script>
export default {
  name: 'NcSlider',
  props: {
    value: Boolean,
  },
  computed: {
    modal: {
      get() {
        return this.value;
      },
      set(v) {
        this.$emit('input', v);
      },
    },
  },
  mounted() {
    (document.querySelector('[data-app]') || this.$root.$el).append(this.$el);
  },
  destroyed() {
    this.$el.parentNode && this.$el.parentNode.removeChild(this.$el);
  },
  created() {
    document.body.addEventListener('keyup', this.onKeyup, true);
  },
  beforeDestroy() {
    document.body.removeEventListener('keyup', this.onKeyup, true);
  },

  methods: {
    onKeyup(e) {
      if (e.key === 'Escape') {
        this.modal = false;
      }
    },
  },
};
</script>

<style scoped lang="scss">
.nc-container {
  position: fixed;
  pointer-events: none;
  width: 100vw;
  height: 100vh;
  z-index: 9999;
  right: 0;
  top: 0;

  .nc-content {
    background-color: var(--v-backgroundColorDefault-base);
    height: 100%;
    width: max(50%, 700px);
    position: absolute;
    bottom: 0;
    top: 0;
    right: min(-50%, -700px);
    transition: 0.3s right;
    overflow-y: auto;
  }

  &.active {
    pointer-events: all;

    & > .nc-content {
      right: 0;
    }
  }
}
</style>
