<template>
  <v-dialog v-model="dialogShow" persistent max-width="500">
    <v-card>
      <v-progress-linear
        indeterminate
        color="green"
        v-if="progressbar"
      ></v-progress-linear>
      <div class="px-2">
        <v-card-title class=" headline">Change environment</v-card-title>
        <v-card-text>
          <div class="">
            <v-select
              hide-details
              dense
              :items="envList"
              v-model="selectedEnv"
              label="Solo field"
              solo
            ></v-select>
          </div>
        </v-card-text>
        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn small :disabled="progressbar" @click="dialogShow = false">Close</v-btn>
          <v-btn color="primary" small :disabled="progressbar" @click="changeEnv">Change</v-btn>
        </v-card-actions>
      </div>
    </v-card>
  </v-dialog>
</template>

<script>

  import {mapGetters} from 'vuex';
  import axios from "axios";

  export default {
    name: "changeEnv",
    data: () => ({
      selectedEnv: 'dev',
      progressbar: false
    }),
    computed: {
      ...mapGetters({
        envList: 'project/GtrEnvList',
      }),
      dialogShow: {
        get() {
          return this.value;
        }, set(val) {
          this.$emit('input', val);
        }
      },
    },
    mounted() {
      const unserializedList = this.$store.state.project.unserializedList;
      this.selectedEnv = (unserializedList[0]
        && unserializedList[0].projectJson
        && unserializedList[0].projectJson.workingEnv) || 'dev';
      this.$store.watch((state) => {
        const unserializedList = state.project.unserializedList
        return (unserializedList[0]
          && unserializedList[0].projectJson
          && unserializedList[0].projectJson.workingEnv) || 'dev'
      }, (value) => this.selectedEnv = value)
    },
    methods: {
      async changeEnv() {
        this.progressbar = true;
        await this.$store.dispatch('sqlMgr/ActSqlOp', [null, 'projectChangeEnv', {env: this.selectedEnv}]);
        await new Promise(resolve => {
          const interv = setInterval(() => {
            axios.create({
              baseURL: process.env.NODE_ENV === 'production' ? './' : 'http://localhost:8080/dashboard',
              // baseURL:  'http://localhost:8080/dashboard',
            }).get('').then(() => {
              this.projectReloading = false;
              clearInterval(interv);
              resolve();
            }).catch(err => {
            })
          }, 1000);
        })
        this.progressbar = false;
        await this.$store.dispatch('users/ActSignOut');

        await this.$store.dispatch('project/ActLoadProjectInfo');
        if (this.$store.state.project.projectInfo.projectHasAdmin === false) {
          return this.$router.push('/start')
        }
        location.reload();
      },
    },
    props: {value: Boolean}
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
