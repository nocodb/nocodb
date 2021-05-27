<template>
  <v-row  justify="center">
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
      <v-card class="elevation-20">
        <!-- <v-toolbar dense height="30">{{ this.heading }}</v-toolbar> -->
        <v-card-title class="grey darken-1 subheading" style="height:30px">
          {{ title || ''}}
        </v-card-title>

        <v-card-text class="pt-4 pl-4">
          <span class="headline ">{{ this.heading }}</span>
        </v-card-text>
<!--        <v-divider></v-divider>-->

        <v-card-actions class="pa-4">
          <v-spacer></v-spacer>
          <v-btn small :class="type" @click="mtdOk()"
          >Ok
          </v-btn
          >
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-row>
</template>

<script>
  import {mapGetters, mapActions} from "vuex";

  export default {
    data() {
      return {

      };
    },
    methods: {},
    computed: {},

    beforeCreated() {
    },
    created() {
    },
    mounted() {
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
    props: ["type", "title", "heading", "dialogShow", "mtdOk"],
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
