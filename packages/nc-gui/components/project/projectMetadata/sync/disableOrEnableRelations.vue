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
      ></v-text-field>

      <v-spacer></v-spacer>
      <x-btn outlined tooltip="Reload list" small @click
             color="primary"
             @click="loadRelations"
             icon="refresh"
             btn.class="text-capitalize"
      >Reload
      </x-btn>
      <x-btn outlined tooltip="Toggle All" small @click
             color="primary"
             @click="toggleAll(toggle)"
             btn.class="text-capitalize" icon="mdi-check-bold">Toggle All {{ toggle ? 'ON' : 'OFF' }}

      </x-btn>
      <x-btn outlined tooltip="Save Changes"
             small
             @click="save"
             :disabled="!edited"
             :loading="updating"
             btn.class="text-capitalize"
             color="primary" icon="save">Save
      </x-btn>

    </v-toolbar>
    <div class="d-flex justify-center">
      <v-skeleton-loader v-if="loading"
                         type="table"
                         class="flex-shrink-1"
                         style="min-width:75%"
      ></v-skeleton-loader>
      <v-data-table dense v-else
                    class="flex-shrink-1"
                    style="min-width:75%"
                    :headers="[{},{},{},{value:'tn'},{value:'rtn'},{}]"
                    hide-default-header
                    :items="relations" :search="search"
      >
        <template v-slot:header="{props:{headers}}">
          <thead>
          <tr class="text-left caption">
            <th>#</th>
            <th>Table Name <span class="caption grey--text">({{ selectedCount }})</span></th>
            <th>Relation</th>
            <th>Parent</th>
            <th>Child</th>
            <th></th>
          </tr>
          </thead>
        </template>


        <template v-slot:item="{item,index}">
          <tr class="caption">

            <td>{{ index + 1 }}</td>
            <td>{{ item.relationType === 'hm' ? item.rtn : item.tn }}</td>
            <td>{{ item.relationType === 'hm' ? 'HasMany' : 'BelongsTo' }}</td>
            <td>{{ item.rtn }}</td>
            <td>{{ item.tn }}</td>
            <td>
              <v-checkbox v-model="item.enabled" @change="$set(item,'edited',true)" class="" dense
                          hide-details></v-checkbox>
            </td>
          </tr>
        </template>
      </v-data-table>
    </div>
  </div>
</template>

<script>
export default {
  name: "disableOrEnableRelations",
  data: () => ({
    loading: true,
    toggle: true,
    updating: false,
    relations: [],
    search: ''
  }),
  methods: {
    async loadRelations() {
      this.loading = true;
      try {
        this.relations = await this.$store.dispatch('sqlMgr/ActSqlOp', [{
          dbAlias: this.dbAlias,
          env: this.$store.getters['project/GtrEnv']
        }, 'xcRelationsGet']);
      } catch (e) {
        console.log(e);
      }
      this.loading = false;
    },
    toggleAll(toggle) {
      this.toggle = !toggle;
      for (let rel of this.relations) {
        this.$set(rel, 'edited', rel.edited || rel.enabled !== toggle);
        this.$set(rel, 'enabled', toggle);
      }
    },
    async save() {
      const editedRelations = this.relations.filter(({edited}) => edited);
      this.updating = true;
      try {
        await this.$store.dispatch('sqlMgr/ActSqlOp', [{
          dbAlias: this.dbAlias,
          env: this.$store.getters['project/GtrEnv']
        }, 'xcRelationsSet', editedRelations]);
        this.$toast.success('Relations enabled/disabled successfully').goAway(3000);
        for (const rel of this.relations) {
          this.$set(rel, 'edited', false)
        }
      } catch (e) {
        this.$toast[e.response?.status === 402 ? 'info' : 'error'](e.message).goAway(3000);
        console.log(e.message);
      }
      this.updating = false;
    }
  },
  computed: {
    selectedCount() {
      return `${this.relations.filter(({enabled}) => enabled).length}/${this.relations.length}`
    },
    edited() {
      return this.relations.some(({edited}) => edited);
    }
  },
  async created() {
    await this.loadRelations();
  },
  props: ['nodes', 'dbAlias']
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
