<template>
  <v-row justify="center">
    <v-dialog
      :value="dialogShow"
      persistent
      max-width="600px"
      @keydown.esc="mtdDialogCancel()"
      @keydown.enter.prevent
    >
      <template #activator="{ on }">
        <p class="hidden" v-on="on" />
      </template>
      <v-card class="elevation-20">
        <v-card-title class="grey darken-2 subheading" style="height:30px">
          <!-- {{ this.heading }} -->
        </v-card-title>
        <v-form ref="form" v-model="valid">
          <v-card-text class="pt-4 pl-4">
            <p class="headline">
              {{ heading }}
            </p>
            <v-text-field
              ref="focus"
              v-model="fieldValue"
              validate-on-blur
              :label="field || ''"
              :rules="[v=> !!v || 'Value required',...(rules || [])]"
              autofocus
              @keydown.enter.prevent="submitForm"
            />
          </v-card-text>
        </v-form>
        <v-divider />

        <v-card-actions class="pa-4">
          <v-spacer />
          <v-btn small class="" @click="mtdDialogCancel()">
            {{ $t('general.cancel') }}
          </v-btn>
          <v-btn
            small
            class="primary"
            @click="submitForm"
          >
            {{ submitText || $t('general.submit') }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-row>
</template>

<script>

export default {
  directives: {},
  components: {},
  validate({ params }) {
    return true
  },
  props: [
    'heading',
    'dialogShow',
    'mtdDialogCancel',
    'mtdDialogSubmit',
    'field',
    'type',
    'cookie',
    'defaultValue',
    'submitText',
    'rules'
  ],
  data() {
    return { fieldValue: '', valid: null }
  },
  head() {
    return {}
  },
  computed: {},
  watch: {},
  created() {
    if (this.defaultValue) { this.fieldValue = this.defaultValue }
  },
  mounted() {
    requestAnimationFrame(() => {
      this.$refs.focus.focus()
    })
  },
  beforeDestroy() {
  },
  methods: {
    submitForm() {
      if (this.$refs.form.validate()) {
        this.mtdDialogSubmit(this.fieldValue, this.cookie)
      }
    }
  },

  beforeCreated() {
  },
  destroy() {
  }
}
</script>

<style scoped>
</style>
<!--
/**
 * @copyright Copyright (c) 2021, Xgene Cloud Ltd
 *
 * @author Naveen MR <oof1lab@gmail.com>
 * @author Pranav C Balan <pranavxc@gmail.com>
 *
 * @license GNU AGPL version 3 or any later version
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program. If not, see <http://www.gnu.org/licenses/>.
 *
 */
-->
