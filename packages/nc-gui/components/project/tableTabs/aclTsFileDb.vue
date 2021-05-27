<template>
  <div>
    <v-card style="">

      <v-toolbar flat height="42" class="toolbar-border-bottom">
        <v-toolbar-title>
          <v-breadcrumbs :items="[{
          text: this.nodes.env,
          disabled: true,
          href: '#'
        },{
          text: this.nodes.dbAlias,
          disabled: true,
          href: '#'
        },
        {
          text: this.nodes.tn + ' (ACL)',
          disabled: true,
          href: '#'
        }]" divider=">" small>
            <template v-slot:divider>
              <v-icon small color="grey lighten-2">forward</v-icon>
            </template>
          </v-breadcrumbs>

        </v-toolbar-title>
        <v-spacer></v-spacer>
        <x-btn outlined tooltip="Reload ACL"
               color="primary"
               small
               v-ge="['acl','reload']"
               @click="reload"
        >
          <v-icon small left>refresh</v-icon>
          Reload
        </x-btn>
        <x-btn tooltip="Open Corresponding Folder"
               icon="mdi-folder-open"
               outlined
               small
               :disabled="!policies || !policies.length"
               color="primary"
               v-ge="['acl','open-folder']"
               @click="openFolder">
          Open Folder
        </x-btn>
        <x-btn outlined tooltip="Save Changes"
               color="primary"
               class="primary"
               small
               @click="save"
               :disabled="disableSaveButton"
               v-ge="['acl','save']">
          <v-icon small left>save</v-icon>
          Save
        </x-btn>

      </v-toolbar>

      <template v-if="loading">
        <v-skeleton-loader
          type="table"
          width="100%"></v-skeleton-loader>

      </template>

      <template v-else>
        <v-text-field dense hide-details class="ma-2" :placeholder="`Search ${nodes.tn} routes`"
                      prepend-inner-icon="search" v-model="search"
                      outlined></v-text-field>
        <acl-typeorm-db-child
          v-if="policies && policies.length"
          ref="acl"
          :nodes="nodes" :search="search" :policies="policies"
        ></acl-typeorm-db-child>

      </template>
      <!--      <acl-ts-file-child-->
      <!--        style="border-bottom: 1px solid grey"-->
      <!--        v-for="policyPath in policyPaths" ref="acl" :nodes="nodes" :search="search" :policyPath="policyPath"></acl-ts-file-child>-->

      <!--      <v-alert v-if="policyPaths && !policyPaths.length" outlined type="info">Permission file not found</v-alert>-->
    </v-card>
  </div>
</template>

<script>
import {mapGetters} from "vuex";
import AclTypeormDbChild from "./aclTsFileDbChild";


// const {shell, path} = require("electron").remote.require('./libs');

export default {
  name: "acl-typeorm-db",
  components: {AclTypeormDbChild},
  props: ["nodes"],
  methods: {

    async aclInit() {
      // // this.disableSaveButton = true;
      // this.policies = (await this.sqlMgr.xcRoutesPolicyGet({
      //   env: this.nodes.env,
      //   dbAlias: this.nodes.dbAlias,
      //   tn: this.nodes.tn
      // })).data.list;
      // this.disableSaveButton = true;
      this.policies = (await this.$store.dispatch('sqlMgr/ActSqlOp', [null, 'xcRoutesPolicyGet', {
        env: this.nodes.env,
        dbAlias: this.nodes.dbAlias,
        tn: this.nodes.tn
      }])).data.list;
    },
    reload() {
      this.$refs.acl.aclInit();
    },
    save() {
      this.$refs.acl.save();
    },
    openFolder() {
    },
  },
  data() {
    return {
      disableSaveButton: false,
      policies: [],
      search: '',
      loading: false
    }
  },
  computed: {
    ...mapGetters({sqlMgr: "sqlMgr/sqlMgr"}),
  },
  mounted() {
    this.$nuxt.$loading.start();
    setTimeout(async () => {
      await this.aclInit();
      this.$nuxt.$loading.finish();
      this.loading = false;

    }, 500);
  },
  watch: {},
  created() {
    this.loading = true;
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
