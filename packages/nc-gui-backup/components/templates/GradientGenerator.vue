<template>
  <div class="d-100 mb-5">
    <div class="rounded pa-5 mb-2 d-100 text-center caption" :style="{ background: value }" @click="generateGradient">
      Click to change gradient
    </div>

    <input v-model="color1" type="color" />
    <input v-model="color2" type="color" />
  </div>
</template>

<script>
export default {
  name: 'GradientGenerator',
  props: {
    value: [String],
  },
  data: () => ({
    angle: 0,
  }),
  computed: {
    color1: {
      get() {
        const val = this.value && this.value.split(',')[1].trim();
        return val;
      },
      set(v) {
        const gradient = 'linear-gradient(' + this.angle + 'deg, ' + v + ', ' + this.color2 + ')';
        this.$emit('input', gradient);
      },
    },
    color2: {
      get() {
        return this.value && this.value.split(',')[2].slice(0, -1).trim();
      },
      set(v) {
        const gradient = 'linear-gradient(' + this.angle + 'deg, ' + this.color1 + ', ' + v + ')';
        this.$emit('input', gradient);
      },
    },
  },
  created() {
    if (!this.color1 && !this.color2) {
      this.generateGradient();
    }
  },
  methods: {
    generateGradient() {
      const hexValues = '0123456789abcde';

      function populate(a) {
        for (let i = 0; i < 6; i++) {
          const x = Math.round(Math.random() * 14);
          const y = hexValues[x];
          a += y;
        }
        return a;
      }

      const newColor1 = populate('#');
      const newColor2 = populate('#');
      this.angle = Math.round(Math.random() * 360);
      const gradient = 'linear-gradient(' + this.angle + 'deg, ' + newColor1 + ', ' + newColor2 + ')';
      this.$emit('input', gradient);
    },
  },
};
</script>

<style scoped></style>
