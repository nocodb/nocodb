<template>
  <v-row justify="center">
    <v-dialog
      persistent
      v-model="dialogErrorShow"
      max-width="500px"
      @keydown.esc="errorDialogCancel()"
      @keydown.enter="errorDialogReport"
    >
      <template v-slot:activator="{ on }">
        <p class="hidden" v-on="on"></p>
      </template>
      <v-card class="pa-2">
        <v-card-title class="headline text-center">
          <span>{{ this.heading }}</span>
        </v-card-title>
        <v-card-text class="" v-if="this.error">
          {{ this.error.message }}
        </v-card-text>

        <v-card-actions class="pa-1">
          <v-spacer></v-spacer>
          <v-btn small class="" @click="errorDialogCancel">
            Cancel
          </v-btn>
          <v-btn small class="warning" @click="errorDialogReport"
          >Report
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
      return {fieldValue: ""};
    },
    methods: {},
    computed: {},

    beforeCreated() {
    },
    created() {
      // if (this.$store.state.windows.isErrorReportingEnabled && !(process.env.NODE_ENV && process.env.NODE_ENV.toLowerCase() === 'dev'))
      //   this.$sentry.captureException(new Error(JSON.stringify({
      //     version: this.$store.state.windows.version,
      //     error: this.error,
      //     user : this.$store.state.users.user && this.$store.state.users.user.email
      //   })))
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
    props: [
      "heading",
      "error",
      "dialogErrorShow",
      "errorDialogCancel",
      "errorDialogReport"
    ],
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
