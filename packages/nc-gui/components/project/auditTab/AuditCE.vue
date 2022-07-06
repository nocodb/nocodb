<template>
  <div class="h-100" style="overflow: auto">
    <v-container class="h-100 d-flex align-center justify-center">
      <v-alert outlined color="success" icon="mdi-information-outline"> Available in Enterprise edition </v-alert>
    </v-container>
  </div>
</template>

<script>
import dayjs from 'dayjs';

const relativeTime = require('dayjs/plugin/relativeTime');
const utc = require('dayjs/plugin/utc');
dayjs.extend(utc);
dayjs.extend(relativeTime);

export default {
  name: 'Audit',
};
</script>

<style scoped></style>
