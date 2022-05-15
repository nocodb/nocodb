<template>
  <div>
    <v-toolbar height="32" class="elevation-0">
      <v-spacer />
      <v-btn
        color="primary"
        small
        outlined
        @click="loadHook"
      >
        <v-icon small class="mr-1" color="primary">
          mdi-reload
        </v-icon>
        <!-- Reload -->
        {{ $t('general.reload') }}
      </v-btn>
      <v-btn
        color="primary"
        small
        outlined
        @click="save"
      >
        <v-icon small class="mr-1" color="primary">
          save
        </v-icon>
        <!-- Save -->
        {{ $t('general.save') }}
      </v-btn>
    </v-toolbar>
    <v-container fluid>
      <v-row>
        <v-col cols="6" offset="3">
          <v-card class="d-100">
            <v-container fluid>
              <v-card-title class="justify-center">
                Auth Hook
              </v-card-title>
              <v-row>
                <v-col cols="12">
                  <v-text-field v-model="data.url" dense label="URL" type="url" class="caption" />
                </v-col>
              </v-row>
            </v-container>
          </v-card>
        </v-col>
      </v-row>
    </v-container>
  </div>
</template>

<script>
export default {
  name: 'AuthHooks',
  props: {
    nodes: Object
  },
  data: () => ({
    data: {}
  }),
  async created() {
    await this.loadHook()
  },
  methods: {
    async loadHook() {
      this.data = await this.$store.dispatch('sqlMgr/ActSqlOp', [{
        dbAlias: this.nodes.dbAlias
      }, 'xcAuthHookGet'])
    },
    async save() {
      try {
        await this.$store.dispatch('sqlMgr/ActSqlOp', [{
          dbAlias: this.nodes.dbAlias
        }, 'xcAuthHookSet', this.data])
        this.$toast.success('Auth hook details updated successfully').goAway(3000)
      } catch (e) {
        console.log(e)
        this.$toast.error('Some error occurred').goAway(3000)
      }
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
