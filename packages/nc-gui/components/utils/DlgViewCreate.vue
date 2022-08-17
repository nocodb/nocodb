<template>
  <v-dialog
    v-model="dialogShow"
    persistent
    max-width="450"
    @keydown.esc="dialogShow = false"
    @keydown.enter="$emit('create', view)"
  >
    <v-card class="elevation-1 backgroundColor">
      <v-card-title class="primary subheading white--text py-2"> Create A New View </v-card-title>

      <v-card-text class="py-6 px-10">
        <v-text-field
          ref="input"
          v-model="view.alias"
          solo
          flat
          dense
          hide-details
          label="Enter the Model Name"
          class="mt-4 caption"
        />

        <v-text-field
          v-if="!projectPrefix"
          v-model="view.name"
          solo
          flat
          dense
          hide-details
          label="SQL View Name"
          class="mt-4 caption"
        />
      </v-card-text>
      <v-divider />

      <v-card-actions class="py-4 px-10">
        <v-spacer />
        <v-btn class="" @click="dialogShow = false">
          {{ $t('general.cancel') }}
        </v-btn>
        <v-btn
          :disabled="!(view.name && view.name.length) || !(view.alias && view.alias.length)"
          color="primary"
          @click="$emit('create', view)"
        >
          {{ $t('general.submit') }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script>
import inflection from 'inflection';

export default {
  name: 'DlgViewCreate',
  props: ['value'],
  data() {
    return {
      view: {
        name: '',
      },
    };
  },
  computed: {
    dialogShow: {
      get() {
        return this.value;
      },
      set(v) {
        this.$emit('input', v);
      },
    },
    projectPrefix() {
      return this.$store.getters['project/GtrProjectPrefix'];
    },
  },
  watch: {
    'view.alias'(v) {
      this.$set(this.view, 'name', `${this.projectPrefix || ''}${inflection.underscore(v)}`);
    },
  },
  mounted() {
    setTimeout(() => {
      this.$refs.input.$el.querySelector('input').focus();
    }, 100);
  },
};
</script>

<style scoped></style>
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
