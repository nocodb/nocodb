<template>
  <v-dialog
    persistent
    @keydown.esc="actionsMtd('hideDialog')"
    @keydown.enter="actionsMtd"
    v-model="dialogShow"
    max-width="450"
  >
    <template v-slot:activator="{ on }">
      <p class="hidden" v-on="on"></p>
    </template>
    <v-card class="elevation-1">
      <!-- <v-toolbar dense height="30">{{ this.heading }}</v-toolbar> -->
      <v-card-title class="grey darken-2 subheading " style="height:30px">
        {{ title || "" }}
      </v-card-title>

      <v-card-text class="pt-4 pl-4">
        <span class="headline ">{{ this.heading }}</span></v-card-text
      >
      <v-divider></v-divider>

      <v-card-actions class="pa-4">
        <v-spacer></v-spacer>
        <v-btn small class="" @click="actionsMtd('hideDialog')">
          Cancel
        </v-btn>
        <v-btn small :class="type" @click="actionsMtd()"
        >Submit
        </v-btn
        >
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script>
import {mapGetters, mapActions} from "vuex";

export default {
  name: 'dlg-label-submit-cancel',
  data() {
    return {};
  },
  methods: {},
  computed: {},

  beforeCreated() {
  },
  created() {
  },
  xcCronSavented() {
  },
  beforeDestroy() {
  },
  destroy() {
  },
  validate({params}) {
    return true;
  },
  head() {
    return {};
  },
  // todo: 2 way binding for dialogShow
  props: ["heading", "dialogShow", "actionsMtd", "title", "type"],
  watch: {},
  directives: {},
  components: {}
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
