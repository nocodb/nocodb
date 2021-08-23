<template>
  <v-dialog
    v-model="dialogShow"
    persistent
    max-width="550"
    @keydown.esc="dialogShow = false"
    @keydown.enter="$emit('create', table)"
  >
    <v-card class="elevation-1 backgroundColor nc-create-table-card">
      <v-card-title class="primary subheading white--text py-2">
        Create A New Table
      </v-card-title>

      <v-card-text class=" py-6 px-10 ">
        <v-text-field
          ref="input"
          v-model="table.alias"
          solo
          flat
          persistent-hint
          dense
          hide-details1
          hint="Enter table name"
          class="mt-4 caption nc-table-name"
        />

        <v-text-field
          v-if="!projectPrefix"
          v-model="table.name"
          solo
          flat
          dense
          persistent-hint
          hint="Table name as saved in database"
          class="mt-4 caption nc-table-name-alias"
        />

        <div class=" mt-5">
          <label class="add-default-title grey--text">Add Default Columns</label>

          <div class=" d-flex caption justify-space-between">
            <v-checkbox
              v-model="table.columns"
              dense
              class="mt-0 "
              color="info"
              hide-details
              value="id"
              @click.capture.prevent.stop="()=>{
                $toast.info('ID column is required, you can rename this later if required.').goAway(3000);
                if(!table.columns.includes('id')){
                  table.columns.push('id');
                }
              }"
            >
              <template #label>
                <span class="caption">id</span>
              </template>
            </v-checkbox>
            <v-checkbox
              v-model="table.columns"
              dense
              class="mt-0 "
              color="info"
              hide-details
              value="title"
            >
              <template #label>
                <span class="caption">title</span>
              </template>
            </v-checkbox>
            <v-checkbox
              v-model="table.columns"
              dense
              class="mt-0 "
              color="info"
              hide-details
              value="created_at"
            >
              <template #label>
                <span class="caption">created_at</span>
              </template>
            </v-checkbox>
            <v-checkbox
              v-model="table.columns"
              dense
              class="mt-0 "
              color="info"
              hide-details
              value="updated_at"
            >
              <template #label>
                <span class="caption">updated_at</span>
              </template>
            </v-checkbox>
          </div>
        </div>
      </v-card-text>
      <v-divider />

      <v-card-actions class="py-4 px-10">
        <v-spacer />
        <v-btn class="" @click="dialogShow = false">
          Cancel
        </v-btn>
        <v-btn
          :disabled="!(table.name && table.name.length) || !(table.alias && table.alias.length)"
          color="primary"
          class="nc-create-table-submit"
          @click="$emit('create',table)"
        >
          Submit
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script>

import inflection from 'inflection'

export default {
  name: 'DlgTableCreate',
  props: ['value'],
  data() {
    return {
      table: {
        name: '',
        columns: ['id',
          'title',
          'created_at',
          'updated_at']
      }
    }
  },
  computed: {
    dialogShow: {
      get() {
        return this.value
      },
      set(v) {
        this.$emit('input', v)
      }
    },
    projectPrefix() {
      return this.$store.getters['project/GtrProjectPrefix']
    }
  },
  watch: {
    'table.alias'(v) {
      this.$set(this.table, 'name', `${this.projectPrefix || ''}${inflection.underscore(v)}`)
    }
  },
  mounted() {
    setTimeout(() => {
      this.$refs.input.$el.querySelector('input').focus()
    }, 100)
  }
}
</script>

<style scoped lang="scss">
::v-deep{
  .v-text-field__details {
    padding:0 2px !important;
    .v-messages__message {
      color: grey;
      font-size: .65rem;
    }
  }
}
.add-default-title{
  font-size: .65rem;
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
