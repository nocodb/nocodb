<template>
  <v-row class="currency-wrapper">
    <v-col cols="6">
      <!--label="Format Locale"-->
      <v-text-field
        v-model="currency_locale"
        dense
        class="caption"
        label="Currency Locale"
        outlined
        hide-details
      />
    </v-col>
    <v-col cols="6">
      <!--label="Currency Code"-->
      <v-text-field
        v-model="currency_code"
        dense
        class="caption"
        label="Currency Code"
        outlined
        hide-details
      />
    </v-col>
  </v-row>
</template>

<script>
export default {
  name: 'CurrencyOptions',
  props: ['nodes', 'column', 'meta', 'isSQLite', 'alias'],
  data: () => ({
    currency_locale: '',
    currency_code: ''
  }),
  watch: {
    currency_locale(v, o) {
      if (v !== o) {
        this.$emit('input', v)
      }
    },
    currency_code(v, o) {
      if (v !== o) {
        this.$emit('input', v)
      }
    }
  },
  created() {
    this.currency_locale = this.column.colOptions?.currency_locale || 'en-US'
    this.currency_code = this.column.colOptions?.currency_code || 'USD'
  },
  methods: {
    async save() {
      try {
        const currencyCol = {
          ...this.column,
          title: this.alias,
          currency_locale: this.currency_locale,
          currency_code: this.currency_code
        }

        await this.$api.dbTableColumn.create(this.meta.id, currencyCol)

        this.$toast.success('Currency column saved successfully').goAway(3000)
        return this.$emit('saved', this.alias)
      } catch (e) {
        this.$toast.error(e.message).goAway(3000)
      }
    },
    async update() {
      try {
        const currencyCol = {
          ...this.column,
          title: this.alias,
          currency_locale: this.currency_locale,
          currency_code: this.currency_code
        }

        await this.$api.dbTableColumn.update(this.column.id, currencyCol)

        return this.$emit('saved', this.alias)
      } catch (e) {
        this.$toast.error(e.message).goAway(3000)
      }
    }
  }
}
</script>

<style scoped lang="scss">
.currency-wrapper {
  margin: 0;
}
</style>
