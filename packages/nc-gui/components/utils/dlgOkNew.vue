<template>
  <v-dialog
    v-model="show"
    max-width="450"
    @keydown.enter="$emit('ok');show = false;"
  >
    <template #activator="{ on }">
      <p class="hidden" v-on="on" />
    </template>
    <v-card class="elevation-20">
      <v-card-title class="grey darken-1 subheading" style="height:30px">
        {{ title || '' }}
      </v-card-title>

      <v-card-text class="pt-4 pl-4">
        <span class="headline ">{{ heading }}</span>
      </v-card-text>

      <v-card-actions class="pa-4">
        <v-spacer />
        <v-btn
          @click="show = false;"
        >
          {{ cancelLabel || $t('general.cancel') }}
        </v-btn>
        <v-btn
          :color="type"
          @click="$emit('ok');show = false;"
        >
          {{ okLabel || $t('general.ok') }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script>

export default {
  name: 'DlgOkNew',
  props: {
    value: Boolean,
    heading: String,
    okLabel: String,
    type: String,
    title: String,
    cancelLabel: String
  },
  data() {
    return {}
  },
  computed: {
    show: {
      get() {
        return this.value
      },
      set(show) {
        this.$emit('input', show)
      }
    }
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
