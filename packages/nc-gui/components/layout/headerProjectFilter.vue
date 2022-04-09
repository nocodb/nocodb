<template>
  <v-text-field
    v-model="query"
    class=""
    hide-details
    solo
    placeholder="Filter projects"
    dense
    background-color="#fff3"
    @input="$nuxt.$emit('projectFilter', query)"
  />
</template>

<script>
export default {
  name: 'HeaderProjectFilter',
  data: () => ({
    query: ''
  })
}
</script>

<style scoped>

</style>
