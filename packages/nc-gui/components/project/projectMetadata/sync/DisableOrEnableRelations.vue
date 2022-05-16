<template>
  <div>
    <v-toolbar flat height="60" class="toolbar-border-bottom">
      <v-text-field
        v-model="search"
        label="Search"
        class="mx-4"
        dense
        outlined
        hide-details
        prepend-inner-icon="search"
      />

      <v-spacer />
      <x-btn
        outlined
        :tooltip="$t('tooltip.reloadList')"
        small
        color="primary"
        icon="refresh"
        btn.class="text-capitalize"
        @click="loadRelations"
      >
        <!-- Reload -->
        {{ $t('general.reload') }}
      </x-btn>
      <!--      <x-btn
        outlined
        tooltip="Toggle All"
        small
        color="primary"
        btn.class="text-capitalize"
        icon="mdi-check-bold"
        @click="toggleAll(toggle)"
      >
        Toggle All {{ toggle ? 'ON' : 'OFF' }}
      </x-btn>-->
      <x-btn
        outlined
        :tooltip="$t('tooltip.saveChanges')"
        small
        :disabled="!edited"
        :loading="updating"
        btn.class="text-capitalize"
        color="primary"
        icon="save"
        @click="save"
      >
        <!-- Save -->
        {{ $t('general.save') }}
      </x-btn>
    </v-toolbar>
    <div class="d-flex justify-center">
      <v-skeleton-loader
        v-if="loading"
        type="table"
        class="flex-shrink-1"
        style="min-width:75%"
      />
      <v-data-table
        v-else
        dense
        class="flex-shrink-1"
        style="min-width:75%"
        :headers="[{},{},{},{value:'tn'},{value:'rtn'},{}]"
        hide-default-header
        :items="relations"
        :search="search"
      >
        <template #header>
          <thead>
            <tr class="text-left caption">
              <th class="grey--text">
                #
              </th>
              <th class="grey--text">
                Table Name <span class="caption grey--text">({{ selectedCount }})</span>
              </th>
              <th class="grey--text">
                Relation
              </th>
              <th class="grey--text">
                Parent
              </th>
              <th class="grey--text">
                Child
              </th>
              <!--              <th />-->
            </tr>
          </thead>
        </template>

        <template #item="{item,index}">
          <tr class="caption">
            <td>{{ index + 1 }}</td>
            <td>{{ item.relationType === 'hm' ? item.rtn : item.table_name }}</td>
            <td>{{ item.relationType === 'hm' ? 'HasMany' : 'BelongsTo' }}</td>
            <td>{{ item.rtn }}</td>
            <td>{{ item.table_name }}</td>
            <!--            <td>
              <v-checkbox
                v-model="item.enabled"
                class=""
                dense
                hide-details
                @change="$set(item,'edited',true)"
              />
            </td>-->
          </tr>
        </template>
      </v-data-table>
    </div>
  </div>
</template>

<script>
export default {
  name: 'DisableOrEnableRelations',
  props: ['nodes', 'dbAlias'],
  data: () => ({
    loading: true,
    toggle: true,
    updating: false,
    relations: [],
    search: ''
  }),
  computed: {
    selectedCount() {
      return `${this.relations.filter(({ enabled }) => enabled).length}/${this.relations.length}`
    },
    edited() {
      return this.relations.some(({ edited }) => edited)
    }
  },
  async created() {
    await this.loadRelations()
  },
  methods: {
    async loadRelations() {
      this.loading = true
      try {
        this.relations = await this.$store.dispatch('sqlMgr/ActSqlOp', [{
          dbAlias: this.dbAlias,
          env: this.$store.getters['project/GtrEnv']
        }, 'xcRelationsGet'])
      } catch (e) {
        console.log(e)
      }
      this.loading = false
    },
    toggleAll(toggle) {
      this.toggle = !toggle
      for (const rel of this.relations) {
        this.$set(rel, 'edited', rel.edited || rel.enabled !== toggle)
        this.$set(rel, 'enabled', toggle)
      }
    },
    async save() {
      const editedRelations = this.relations.filter(({ edited }) => edited)
      this.updating = true
      try {
        await this.$store.dispatch('sqlMgr/ActSqlOp', [{
          dbAlias: this.dbAlias,
          env: this.$store.getters['project/GtrEnv']
        }, 'xcRelationsSet', editedRelations])
        this.$toast.success('Relations enabled/disabled successfully').goAway(3000)
        for (const rel of this.relations) {
          this.$set(rel, 'edited', false)
        }
      } catch (e) {
        this.$toast[e.response?.status === 402 ? 'info' : 'error'](e.message).goAway(3000)
        console.log(e.message)
      }
      this.updating = false
    }
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
