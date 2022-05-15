<template>
  <v-container v-if="db" fluid>
    <v-card>
      <v-card class="pb-2">
        <v-toolbar flat height="50" class="toolbar-border-bottom">
          <v-text-field
            v-if="db"
            v-model="filter"
            dense
            hide-details
            class="my-2 mx-auto search-field"
            :placeholder="`Search '${db.connection.database}' models`"
            style="max-width:300px"
            outlined
          >
            <template #prepend-inner>
              <v-icon small>
                search
              </v-icon>
            </template>
          </v-text-field>

          <v-spacer />
          <x-btn
            outlined
            :tooltip="$t('tooltip.reloadList')"
            small
            color="primary"
            icon="refresh"
            @click="loadViewList()"
          >
            <!-- Reload -->
            {{ $t('general.reload') }}
          </x-btn>
          <x-btn
            outlined
            :loading="updating"
            :disabled="updating || !edited"
            :tooltip="$t('tooltip.saveChanges')"
            small
            color="primary"
            icon="save"
            @click="save()"
          >
            <!-- Save -->
            {{ $t('general.save') }}
          </x-btn>
        </v-toolbar>

        <div class="d-flex d-100 justify-center">
          <v-simple-table dense style="min-width: 400px">
            <thead>
              <tr>
                <th>Table Name</th>
                <th>Relation</th>
                <th>Parent</th>
                <th>Child</th>
                <th v-for="role in roles" :key="role">
                  {{ role }}
                </th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="(relation,i) in relations"
                :key="i"
              >
                <td>{{ relation.relationType === 'hm' ? relation.rtn : relation.table_name }}</td>
                <td>{{ relation.relationType === 'hm' ? 'HasMany' : 'BelongsTo' }}</td>
                <td>{{ relation.rtn }}</td>
                <td>{{ relation.table_name }}</td>

                <td v-for="role in roles" :key="`${i}-${role}`">
                  <v-tooltip bottom>
                    <template #activator="{on}">
                      <div
                        v-on="on"
                      >
                        <v-checkbox
                          v-model="relation.disabled[role]"
                          dense
                          :true-value="false"
                          :false-value="true"
                          @change="$set(relation,'edited',true)"
                        />
                      </div>
                    </template>

                    <!--         <span v-if="relation.disabled[role]">Click to hide '{{ relation.relation_name }}' for Role:{{ role }} in UI dashboard</span>
                  <span v-else>Click to make '{{ relation.relation_name }}' visible for Role:{{
                      role
                    }} in UI dashboard</span>-->
                  </v-tooltip>
                </td>
              </tr>
            </tbody>
          </v-simple-table>
        </div>
      </v-card>
    </v-card>
  </v-container>
</template>

<script>
import { mapGetters } from 'vuex'

export default {
  name: 'ToggleRelationsUiAcl',
  components: {},
  props: ['nodes', 'db'],
  data: () => ({
    models: null,
    updating: false,
    dbsTab: 0,
    filter: '',
    relations: null
  }),
  async mounted() {
    await this.loadViewList()
  },
  methods: {
    async loadViewList() {
      this.relations = (await this.$store.dispatch('sqlMgr/ActSqlOp', [{
        dbAlias: this.db.meta.dbAlias,
        env: this.$store.getters['project/GtrEnv']
      }, 'xcVisibilityMetaGet', {
        type: 'relation'
      }]))
    },
    async save() {
      try {
        await this.$store.dispatch('sqlMgr/ActSqlOp', [{
          dbAlias: this.db.meta.dbAlias,
          env: this.$store.getters['project/GtrEnv']
        }, 'xcVisibilityMetaSet', {
          type: 'relation',
          disableList: this.relations.filter(t => t.edited)
        }])
        this.$toast.success('Updated UI ACL for tables successfully').goAway(3000)
      } catch (e) {
        this.$toast.error('Some error occurred').goAway(3000)
      }
    }
  },
  computed: {
    ...mapGetters({
      dbAliasList: 'project/GtrDbAliasList'
    }),
    edited() {
      return this.relations && this.relations.length && this.relations.some(t => t.edited)
    },
    roles() {
      return this.relations && this.relations.length ? Object.keys(this.relations[0].disabled) : []
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

  .search-field.v-text-field > .v-input__control, .search-field.v-text-field > .v-input__control > .v-input__slot {
    min-height: auto;

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
