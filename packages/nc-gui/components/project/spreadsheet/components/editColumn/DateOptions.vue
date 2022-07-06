<template>
  <v-autocomplete
    v-model="colMeta.date_format"
    label="Date Format"
    class="caption nc-column-name-input"
    :rules="[isValidDateFormat]"
    :items="dateFormatList"
    dense
    outlined
  />
</template>
<script>
import { dateFormat, validateDateFormat } from '~/helpers/dateFormatHelper'
export default {
  name: 'DateOptions',
  props: ['column', 'meta', 'value'],
  data: () => ({
    colMeta: {
      date_format: 'YYYY-MM-DD'
    },
    dateFormatList: dateFormat,
    isValidDateFormat: (value) => {
      return validateDateFormat(value) || 'Invalid Date Format'
    }
  }),
  watch: {
    value() {
      this.colMeta = this.value || {}
    },
    colMeta(v) {
      this.$emit('input', v)
    }
  },
  created() {
    this.colMeta = this.value ? { ...this.value } : { ...this.colMeta }
  }
}
</script>
