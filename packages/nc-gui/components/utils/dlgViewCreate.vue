<template>
  <v-dialog
    persistent
    @keydown.esc="dialogShow = false"
    @keydown.enter="$emit('create', view)"
    v-model="dialogShow"
    max-width="450"
  >

    <v-card class="elevation-1 backgroundColor">
      <v-card-title class="primary subheading white--text py-2">
        Create A New View
      </v-card-title>

      <v-card-text class=" py-6 px-10 ">
        <v-text-field
          ref="input"
          solo flat
          v-model="view.alias"
          dense hide-details label="Enter the Model Name" class="mt-4 caption"></v-text-field>

        <v-text-field
          v-if="!projectPrefix"
          solo flat
          v-model="view.name"
          dense hide-details label="SQL View Name" class="mt-4 caption"></v-text-field>

      </v-card-text>
      <v-divider></v-divider>

      <v-card-actions class="py-4 px-10">
        <v-spacer></v-spacer>
        <v-btn class="" @click="dialogShow = false">
          Cancel
        </v-btn>
        <v-btn
          :disabled="!(view.name && view.name.length) || !(view.alias && view.alias.length)"
          color="primary" @click="$emit('create',view)">Submit
        </v-btn
        >
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script>

import inflection from "inflection";

export default {
  name: 'dlg-view-create',
  data() {
    return {
      view: {
        name: ''
      }
    };
  },
  props: ['value'],
  computed: {
    dialogShow: {
      get() {
        return this.value
      }, set(v) {
        this.$emit('input', v)
      }
    },
    projectPrefix() {
      return this.$store.getters['project/GtrProjectPrefix']
    }
  }, watch: {
    'view.alias': function (v) {
      this.$set(this.view, 'name', `${this.projectPrefix || ''}${inflection.underscore(v)}`)
    }
  },
  mounted() {
    setTimeout(() => {
      this.$refs.input.$el.querySelector('input').focus();
    }, 100)
  }
};
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
