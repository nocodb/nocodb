<template>
  <a v-if="value">{{ currency }}</a>
  <span v-else />
</template>

<script>
export default {
  name: 'CurrencyCell',
  props: ['value', 'column'],
  computed: {
    currency() {
      try {
        return new Intl.NumberFormat(this.column.colOptions?.currency_locale || 'en-US',
          { style: 'currency', currency: this.column.colOptions?.currency_code || 'USD' }).format(this.value)
      } catch (e) {
        return this.value
      }
    }
  }
}
</script>

<style scoped>

</style>
