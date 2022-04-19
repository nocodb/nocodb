<template>
  <div>
    <v-tabs v-model="dbsTab" color="x-active" height="30">
      <v-tab href="#xc-project-meta">
        <v-icon icon x-small class="mr-2">
          mdi-file-table-box-multiple-outline
        </v-icon>
        <span class="caption text-capitalize nc-exp-imp-metadata">
          <!-- Export/Import Metadata -->
          {{ $t('title.exportImportMeta') }}
        </span>
      </v-tab>
      <v-tab-item value="xc-project-meta">
        <div class="d-flex justify-center d-100">
          <xc-meta />
        </div>
      </v-tab-item>

      <template v-for="(db,i) in bases">
        <v-tab :key="db.id + i" :href="'#' + db.id + 'meta'" class="text-capitalize caption nc-meta-mgmt-metadata-tab">
          <!--          {{ db.connection.database | extractDbName }} {{ db.id }} -->
          <!-- Metadata -->
          {{ $t('title.metadata') }}
        </v-tab>
        <v-tab-item :key="db.id + 't' + i" :value="db.id + 'meta'">
          <metaDiffSync
            :nodes="nodes"
            :db="db"
            :db-id="db.id"
          />
        </v-tab-item>
        <template v-if="uiacl">
          <v-tab :key="db.id + 'acl'" :href="'#' + db.id + 'acl'" class="text-capitalize caption nc-ui-acl-tab">
            <!--UI Access Control-->
            {{ $t('title.uiACL') }}
          </v-tab>
          <v-tab-item :key="db.id + 'aclt'" :value=" db.id + 'acl'">
            <v-tabs color="x-active" height="28">
              <v-tab class="text-capitalize caption">
                <!-- Tables -->
                {{ $t('objects.tables') }}
              </v-tab>
              <v-tab-item>
                <toggle-table-ui-acl
                  :nodes="nodes"
                  :db="db"
                  :db-alias="db.id"
                />
              </v-tab-item>
            </v-tabs>
          </v-tab-item>
        </template>
      </template>
    </v-tabs>
  </div>
</template>

<script>
import { mapGetters } from 'vuex'
import XcMeta from '../settings/xcMeta'
import { isMetaTable } from '@/helpers/xutils'
import metaDiffSync from '~/components/project/projectMetadata/sync/metaDiffSync'
import ToggleTableUiAcl from '@/components/project/projectMetadata/uiAcl/toggleTableUIAcl'

export default {
  name: 'DisableOrEnableModels',
  components: {
    ToggleTableUiAcl,
    metaDiffSync,
    XcMeta
  },
  props: ['nodes'],
  data: () => ({
    uiacl: true,
    edited: false,
    models: null,
    updating: false,
    // dbsTab: 0,
    filter: '',
    tables: null
  }),
  async mounted() {
  },
  methods: {},
  computed: {
    bases() {
      return this.$store.state.project.project && this.$store.state.project.project.bases
    },
    dbsTab: {
      set(tab) {
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
      get() {
        return this.$route.query.nested_1
      }

    },

    ...mapGetters({
      dbAliasList: 'project/GtrDbAliasList'
    }),
    enableCountText() {
      return this.models
        ? `${this.models.filter(m => m.enabled).length}/${this.models.length} enabled`
        : ''
    },

    isNewOrDeletedModelFound() {
      return this.comparedModelList.some(m => m.new || m.deleted)
    },
    comparedModelList() {
      const res = []
      const getPriority = (item) => {
        if (item.new) { return 2 }
        if (item.deleted) { return 1 }
        return 0
      }
      if (this.tables && this.models) {
        const tables = this.tables.filter(t => !isMetaTable(t.table_name)).map(t => t.table_name)
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
  },
  filters: {
    extractDbName(name) {
      return (name || '').split('/').pop()
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
