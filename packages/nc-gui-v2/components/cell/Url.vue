<script>
import { isValidURL } from '~/helpers'

export default {
  name: 'UrlCell',
  props: ['value'],
  computed: {
    isValid() {
      return this.value && isValidURL(this.value)
    },
  },
}
</script>

<template>
  <a v-if="isValid" :href="value" target="_blank">{{ value }}</a>
  <span v-else>{{ value }}</span>
</template>

<style scoped></style>
