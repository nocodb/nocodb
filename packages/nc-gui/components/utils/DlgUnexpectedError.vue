<template>
  <v-row justify="center">
    <v-dialog
      :value="dialogErrorShow"
      persistent
      max-width="500px"
      @keydown.esc="errorDialogCancel()"
      @keydown.enter="errorDialogReport"
    >
      <template #activator="{ on }">
        <p class="hidden" v-on="on" />
      </template>
      <v-card class="pa-2">
        <v-card-title class="headline text-center">
          <span>{{ heading }}</span>
        </v-card-title>
        <v-card-text v-if="error" class="">
          {{ error.message }}
        </v-card-text>

        <v-card-actions class="pa-1">
          <v-spacer />
          <v-btn small class="" @click="errorDialogCancel">
            {{ $t('general.cancel') }}
          </v-btn>
          <v-btn
            small
            class="warning"
            @click="errorDialogReport"
          >
            Report
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
    'error',
    'dialogErrorShow',
    'errorDialogCancel',
    'errorDialogReport'
  ],
  data() {
    return { fieldValue: '' }
  },
  head() {
    return {}
  },
  computed: {},
  watch: {},
  created() {
  },
  mounted() {
  },
  beforeDestroy() {
  },
  methods: {},

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
