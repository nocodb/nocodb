<template>
  <div>
    <v-tabs v-model="dbsTab" color="x-active" height="30">
      <v-tab href="#xc-project-meta">
        <v-icon icon x-small class="mr-2">
          mdi-file-table-box-multiple-outline
        </v-icon>
        <span class="caption text-capitalize"> Project Metadata</span>
      </v-tab>
      <v-tab-item value="xc-project-meta">
        <div class="d-flex justify-center d-100">
          <xc-meta />
        </div>
      </v-tab-item>

      <template v-for="(db,i) in dbAliasList">
        <v-tab :key="db.meta.dbAlias + i" :href="'#' + db.meta.dbAlias" class="text-capitalize caption">
          {{ db.connection.database }} {{ db.meta.dbAlias }} Metadata
        </v-tab>
        <v-tab-item :key="db.meta.dbAlias + 't' + i" :value=" db.meta.dbAlias">
          <v-tabs color="x-active" height="28">
            <v-tab class="text-capitalize caption">
              Tables
            </v-tab>
            <v-tab-item>
              <disable-or-enable-tables
                :nodes="nodes"
                :db="db"
                :db-alias="db.meta.dbAlias"
              />
            </v-tab-item>
            <!-- enable extra -->
            <!-- <v-tab class="text-capitalize caption">Views</v-tab>
             <v-tab-item>
               <disable-or-enable-views
                 :nodes="nodes" :db="db"
                                        :db-alias="db.meta.dbAlias"></disable-or-enable-views>
             </v-tab-item>
             <v-tab class="text-capitalize caption">Functions</v-tab>
             <v-tab-item>
               <disable-or-enable-functions :nodes="nodes" :db="db"
                                            :db-alias="db.meta.dbAlias"></disable-or-enable-functions>
             </v-tab-item>
             <v-tab class="text-capitalize caption">Procedures</v-tab>
             <v-tab-item>
               <disable-or-enable-procedures :nodes="nodes" :db="db"
                                             :db-alias="db.meta.dbAlias"></disable-or-enable-procedures>
             </v-tab-item>-->

            <v-tab class="text-capitalize caption">
              Relations
            </v-tab>
            <v-tab-item>
              <disable-or-enable-relations :nodes="nodes" :db-alias="db.meta.dbAlias" />
            </v-tab-item>
          </v-tabs>
        </v-tab-item>

        <v-tab :key="db.meta.dbAlias + 'acl'" :href="'#' + db.meta.dbAlias + 'acl'" class="text-capitalize caption">
          {{ db.connection.database }} UI Access Control
        </v-tab>
        <v-tab-item :key="db.meta.dbAlias + 'aclt'" :value=" db.meta.dbAlias + 'acl'">
          <v-tabs color="x-active" height="28">
            <v-tab class="text-capitalize caption">
              Tables
            </v-tab>
            <v-tab-item>
              <toggle-table-ui-acl
                :nodes="nodes"
                :db="db"
                :db-alias="db.meta.dbAlias"
              />
            </v-tab-item>
            <!-- enable extra -->
            <!--  <v-tab class="text-capitalize caption">Views</v-tab>
              <v-tab-item>
                <toggle-view-ui-acl :nodes="nodes" :db="db"
                                    :db-alias="db.meta.dbAlias"></toggle-view-ui-acl>
              </v-tab-item>
              <v-tab class="text-capitalize caption">Functions</v-tab>
              <v-tab-item>
                <toggle-function-ui-acl :nodes="nodes" :db="db"
                                        :db-alias="db.meta.dbAlias"></toggle-function-ui-acl>
              </v-tab-item>

              <v-tab class="text-capitalize caption">Procedures</v-tab>
              <v-tab-item>
                <toggle-procedure-ui-acl :nodes="nodes" :db="db"
                                         :db-alias="db.meta.dbAlias"></toggle-procedure-ui-acl>

              </v-tab-item>-->
            <v-tab class="text-capitalize caption">
              Relations
            </v-tab>
            <v-tab-item>
              <toggle-relations-ui-acl
                :nodes="nodes"
                :db="db"
                :db-alias="db.meta.dbAlias"
              />
            </v-tab-item>
          </v-tabs>
        </v-tab-item>
      </template>
    </v-tabs>
  </div>
</template>

<script>
import { mapGetters } from 'vuex'
import { isMetaTable } from '@/helpers/xutils'
import DisableOrEnableTables from '@/components/project/projectMetadata/sync/disableOrEnableTables'
import ToggleTableUiAcl from '@/components/project/projectMetadata/uiAcl/toggleTableUIAcl'
import ToggleRelationsUiAcl from '@/components/project/projectMetadata/uiAcl/toggleRelationsUIAcl'
import XcMeta from '../settings/xcMeta'
import DisableOrEnableRelations from './sync/disableOrEnableRelations'

export default {
  name: 'DisableOrEnableModels',
  components: {
    ToggleRelationsUiAcl,
    ToggleTableUiAcl,
    DisableOrEnableTables,
    XcMeta,
    DisableOrEnableRelations
  },
  props: ['nodes'],
  data: () => ({
    edited: false,
    models: null,
    updating: false,
    // dbsTab: 0,
    filter: '',
    tables: null
  }),
  async mounted () {
  },
  methods: {},
  computed: {
    dbsTab: {
      set (tab) {
        if (!tab) {
          // return this.$router.push({
          //   query: {}
          // })
          return
        }
        // eslint-disable-next-line camelcase
        const nested_1 = tab
        this.$router.push({
          query: {
            ...this.$route.query,
            nested_1
          }
        })
      },
      get () {
        return this.$route.query.nested_1
      }

    },

    ...mapGetters({
      dbAliasList: 'project/GtrDbAliasList'
    }),
    enableCountText () {
      return this.models
        ? `${this.models.filter(m => m.enabled).length}/${this.models.length} enabled`
        : ''
    },

    isNewOrDeletedModelFound () {
      return this.comparedModelList.some(m => m.new || m.deleted)
    },
    comparedModelList () {
      const res = []
      const getPriority = (item) => {
        if (item.new) { return 2 }
        if (item.deleted) { return 1 }
        return 0
      }
      if (this.tables && this.models) {
        const tables = this.tables.filter(t => !isMetaTable(t.tn)).map(t => t.tn)
        res.push(...this.models.map((m) => {
          const i = tables.indexOf(m.title)
          if (i === -1) {
            m.deleted = true
          } else {
            tables.splice(i, 1)
          }
          return m
        }))
        res.push(...tables.map(t => ({
          title: t, new: true
        })))
      }
      res.sort((a, b) => getPriority(b) - getPriority(a))
      return res
    }
  }
}
</script>

<style scoped lang="scss">
::v-deep {
  .v-tabs-bar {
    border-bottom: solid 1px #7f828b33;
  }

  .v-tab {
    border-right: 1px solid #7f828b33;
  }
}

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
