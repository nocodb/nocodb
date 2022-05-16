<template>
  <a v-if="value" :href="value" target="_blank">{{ value }}</a>
  <span v-else />
</template>

<script>
export default {
  name: 'UrlCell',
  props: ['value']
}
</script>

<style scoped>

</style>
