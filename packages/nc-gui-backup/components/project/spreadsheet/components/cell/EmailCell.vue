<template>
  <a v-if="isEmail" :href="`mailto:${value}`" target="_blank">{{ value }}</a>
  <span v-else>{{ value }}</span>
</template>

<script>
import { isEmail } from '~/helpers';

export default {
  name: 'EmailCell',
  props: ['value'],
  computed: {
    isEmail() {
      return isEmail(this.value || '');
    },
  },
};
</script>

<style scoped></style>
