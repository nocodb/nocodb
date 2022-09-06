<template>
  <v-dialog v-model="dialogShow" persistent max-width="500">
    <v-card>
      <v-progress-linear v-if="progressbar" indeterminate color="green" />
      <div class="px-2">
        <v-card-title class="headline"> Change environment </v-card-title>
        <v-card-text>
          <div class="">
            <v-select v-model="selectedEnv" hide-details dense :items="envList" label="Solo field" solo />
          </div>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn small :disabled="progressbar" @click="dialogShow = false">
            <!-- Close -->
            {{ $t('general.close') }}
          </v-btn>
          <v-btn color="primary" small :disabled="progressbar" @click="ChangeEnv"> Change </v-btn>
        </v-card-actions>
      </div>
    </v-card>
  </v-dialog>
</template>

<script>
import { mapGetters } from 'vuex';
import axios from 'axios';

export default {
  name: 'ChangeEnv',
  data: () => ({
    selectedEnv: '_noco',
    progressbar: false,
  }),
  computed: {
    ...mapGetters({
      envList: 'project/GtrEnvList',
    }),
    dialogShow: {
      get() {
        return this.value;
      },
      set(val) {
        this.$emit('input', val);
      },
    },
  },
  mounted() {
    const unserializedList = this.$store.state.project.unserializedList;
    this.selectedEnv =
      (unserializedList[0] && unserializedList[0].projectJson && unserializedList[0].projectJson.workingEnv) || '_noco';
    this.$store.watch(
      state => {
        const unserializedList = state.project.unserializedList;
        return (
          (unserializedList[0] && unserializedList[0].projectJson && unserializedList[0].projectJson.workingEnv) ||
          '_noco'
        );
      },
      value => {
        this.selectedEnv = value;
      }
    );
  },
  methods: {
    async changeEnv() {
      this.progressbar = true;
      await this.$store.dispatch('sqlMgr/ActSqlOp', [null, 'projectChangeEnv', { env: this.selectedEnv }]);
      await new Promise(resolve => {
        const interv = setInterval(() => {
          axios
            .create({
              baseURL: `${this.$axios.defaults.baseURL}/dashboard`,
            })
            .get('')
            .then(() => {
              this.projectReloading = false;
              clearInterval(interv);
              resolve();
            })
            .catch(() => {});
        }, 1000);
      });
      this.progressbar = false;
      await this.$store.dispatch('users/ActSignOut');

      await this.$store.dispatch('project/ActLoadProjectInfo');
      if (this.$store.state.project.appInfo.projectHasAdmin === false) {
        return this.$router.push('/start');
      }
      location.reload();
    },
  },
  props: { value: Boolean },
};
</script>

<style scoped></style>

<!--
/**
 * @copyright Copyright (c) 2021, Xgene Cloud Ltd
 *
 * @author Naveen MR <oof1lab@gmail.com>
 * @author Pranav C Balan <pranavxc@gmail.com>
 * @author Wing-Kam Wong <wingkwong.code@gmail.com>
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
