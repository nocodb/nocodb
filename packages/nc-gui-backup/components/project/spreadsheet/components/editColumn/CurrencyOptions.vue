<template>
  <v-tooltip top :disabled="!(isMoney && isPG)">
    <template #activator="{ on, attrs }">
      <v-row class="currency-wrapper" v-bind="attrs" v-on="on">
        <v-col cols="6">
          <!--label="Format Locale"-->
          <v-autocomplete
            v-model="colMeta.currency_locale"
            dense
            class="caption"
            label="Currency Locale"
            :rules="[isValidCurrencyLocale]"
            :items="currencyLocaleList"
            outlined
            hide-details
            :disabled="isMoney && isPG"
          />
        </v-col>
        <v-col cols="6">
          <!--label="Currency Code"-->
          <v-autocomplete
            v-model="colMeta.currency_code"
            dense
            class="caption"
            label="Currency Code"
            :rules="[isValidCurrencyCode]"
            :items="currencyList"
            outlined
            hide-details
            :disabled="isMoney && isPG"
          />
        </v-col>
      </v-row>
    </template>
    <span>{{ message }}</span>
  </v-tooltip>
</template>

<script>
import { currencyCodes, currencyLocales, validateCurrencyCode, validateCurrencyLocale } from '~/helpers/currencyHelper';

export default {
  name: 'CurrencyOptions',
  props: ['column', 'meta', 'value'],
  data: () => ({
    colMeta: {
      currency_locale: 'en-US',
      currency_code: 'USD',
    },
    currencyList: currencyCodes,
    currencyLocaleList: currencyLocales(),
    isValidCurrencyLocale: value => {
      return validateCurrencyLocale(value) || 'Invalid locale';
    },
    isValidCurrencyCode: value => {
      return validateCurrencyCode(value) || 'Invalid Currency Code';
    },
  }),
  computed: {
    isMoney() {
      return this.column.dt === 'money';
    },
    isPG() {
      return ['pg'].includes(this.$store.getters['project/GtrClientType']);
    },
    message() {
      if (this.isMoney && this.isPG) {
        return "PostgreSQL 'money' type has own currency settings";
      }
      return '';
    },
  },
  watch: {
    value() {
      this.colMeta = this.value || {};
    },
    colMeta(v) {
      this.$emit('input', v);
    },
  },
  created() {
    this.colMeta = this.value ? { ...this.value } : { ...this.colMeta };
  },
};
</script>

<style scoped>
.currency-wrapper {
  margin: 0;
}
/deep/ .v-input__append-inner {
  margin-top: 4px !important;
}
</style>
