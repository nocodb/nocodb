<script>
export default {
  name: 'CurrencyCell',
  props: {
    column: Object,
    value: [String, Number],
  },
  computed: {
    currency() {
      try {
        return isNaN(this.value)
          ? this.value
          : new Intl.NumberFormat(this.currencyMeta.currency_locale || 'en-US', {
              style: 'currency',
              currency: this.currencyMeta.currency_code || 'USD',
            }).format(this.value)
      } catch (e) {
        return this.value
      }
    },
    currencyMeta() {
      return {
        currency_locale: 'en-US',
        currency_code: 'USD',
        ...(this.column && this.column.meta ? this.column.meta : {}),
      }
    },
  },
}
</script>

<template>
  <a v-if="value">{{ currency }}</a>
  <span v-else />
</template>

<style scoped></style>
