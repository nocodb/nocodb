<template>
  <v-rating
    v-model="localState"
    hover
    length="10"
    size="10"
    dense
    x-small
  />
</template>

<script>
export default {
  name: 'RatingCell',
  props: {
    column: Object,
    value: [String, Number]
  },
  computed: {
    localState: {
      get() {
        return this.value
      },
      set(val) {
        this.$emit('input', val)
      }
    }
  }
}
</script>

<style scoped>

</style>
