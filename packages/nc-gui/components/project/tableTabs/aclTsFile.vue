<!-- eslint-disable -->
<template>
  <div>
    <v-card style="">
      <v-toolbar flat height="42" class="toolbar-border-bottom">
        <v-toolbar-title>
          <v-breadcrumbs
            :items="[{
                       text: nodes.env,
                       disabled: true,
                       href: '#'
                     },{
                       text: nodes.dbAlias,
                       disabled: true,
                       href: '#'
                     },
                     {
                       text: nodes.table_name + ' (ACL)',
                       disabled: true,
                       href: '#'
                     }]"
            divider=">"
            small
          >
            <template #divider>
              <v-icon small color="grey lighten-2">
                forward
              </v-icon>
            </template>
          </v-breadcrumbs>
        </v-toolbar-title>
        <v-spacer />
        <x-btn
          v-ge="['acl','reload']"
          outlined
          tooltip="Reload ACL"
          color="primary"
          small
          @click="reload"
        >
          <v-icon small left>
            refresh
          </v-icon>
          <!-- Reload -->
          {{ $t('general.reload') }}
        </x-btn>
        <x-btn
          v-ge="['acl','open-folder']"
          tooltip="Open Corresponding Folder"
          icon="mdi-folder-open"
          outlined
          small
          :disabled="!policyPaths || !policyPaths.length"
          color="primary"
          @click="openFolder"
        >
          Open Folder
        </x-btn>
        <x-btn
          v-ge="['acl','save']"
          outlined
          :tooltip="$t('tooltip.saveChanges')"
          color="primary"
          class="primary"
          small
          :disabled="disableSaveButton"
          @click="save"
        >
          <v-icon small left>
            save
          </v-icon>
          <!-- Save -->
          {{ $t('general.save') }}
        </x-btn>
      </v-toolbar>

      <v-text-field
        v-model="search"
        dense
        hide-details
        class="ma-2"
        :placeholder="`Search ${nodes.table_name} routes`"
        prepend-inner-icon="search"
        outlined
      />

      <acl-ts-file-child
        v-for="(policyPath,k) in policyPaths"
        :key="k"
        ref="acl"
        style="border-bottom: 1px solid grey"
        :nodes="nodes"
        :search="search"
        :policy-path="policyPath"
      />

      <v-alert v-if="policyPaths && !policyPaths.length" outlined type="info">
        Permission file not found
      </v-alert>
    </v-card>
  </div>
</template>

<script>
import { mapGetters } from 'vuex'
import aclTsFileChild from './aclTsFileChild'

// const {shell, path} = require("electron").remote.require('./libs');

export default {
  name: 'AclTypeorm',
  components: { aclTsFileChild },
  props: ['nodes'],
  data() {
    return {
      policyPaths: null,
      search: ''
    }
  },
  methods: {

    async aclInit() {
      // this.disableSaveButton = true;
      // this.policyPaths = await this.sqlMgr.projectGetTsPolicyPath({
      //   env: this.nodes.env,
      //   dbAlias: this.nodes.dbAlias,
      //   tn: this.nodes.table_name
      // });

      this.policyPaths = await this.$store.dispatch('sqlMgr/ActSqlOp', [{
        env: this.nodes.env,
        dbAlias: this.nodes.dbAlias
      }, 'projectGetTsPolicyPath', {
        table_name: this.nodes.table_name
      }])
    },
    reload() {
      for (const $acl of this.$refs.acl) {
        $acl.aclInit()
      }
    },
    save() {
      for (const $acl of this.$refs.acl) {
        $acl.save()
      }
    },
    openFolder() {
      // shell.openItem(path.dirname(this.policyPaths[0]));
    }
  },
  computed: {
    ...mapGetters({ sqlMgr: 'sqlMgr/sqlMgr' })
  },
  watch: {},
  async created() {
    await this.aclInit()
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
