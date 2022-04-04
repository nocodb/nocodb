<template>
  <div class="d-flex align-center d-100">
    <v-icon v-if="column.pk" color="warning" x-small class="mr-1">
      mdi-key-variant
    </v-icon>
    <v-icon v-else-if="uiDatatypeIcon" small class="mr-1">
      {{ uiDatatypeIcon }}
    </v-icon>

    <v-icon v-else-if="isForeignKey" color="purple" small class="mr-1">
      mdi-link-variant
    </v-icon>
    <v-icon v-else-if="isJSON" color="purple" small class="mr-1">
      mdi-code-json
    </v-icon>

    <span v-else-if="isInt" class="font-weight-bold mr-1" style="font-size: 15px">#</span>
    <v-icon v-else-if="isFloat" color="grey" class="mr-1 mt-n1">
      mdi-decimal
    </v-icon>
    <v-icon v-else-if="isDate" color="grey" small class="mr-1">
      mdi-calendar
    </v-icon>
    <v-icon v-else-if="isDateTime" color="grey" small class="mr-1">
      mdi-calendar-clock
    </v-icon>
    <v-icon v-else-if="isSet" color="grey" small class="mr-1">
      mdi-checkbox-multiple-marked
    </v-icon>
    <v-icon v-else-if="isEnum" color="grey" small class="mr-1">
      mdi-radiobox-marked
    </v-icon>
    <v-icon v-else-if="isBoolean" color="grey" small class="mr-1">
      mdi-check-box-outline
    </v-icon>
    <v-icon v-else-if="isString" color="grey" class="">
      mdi-alpha-a
    </v-icon>
    <v-icon v-else-if="isTextArea" color="grey" small class="mr-1">
      mdi-card-text-outline
    </v-icon>

    <span class="name" style="white-space: nowrap" :title="value">{{ value }}</span>

    <span v-if="(column.rqd && !column.cdf) || required" class="error--text text--lighten-1">&nbsp;*</span>

    <v-spacer />

    <v-menu
      v-if="!isLocked &&!isPublicView && _isUIAllowed('edit-column') && !isForm"
      open-on-hover
      left
      z-index="999"
    >
      <template #activator="{on}">
        <v-icon v-if="!isLocked && !isVirtual" small v-on="on">
          mdi-menu-down
        </v-icon>
      </template>
      <v-list dense>
        <v-list-item
          class="nc-column-edit"
          dense
          @click="editColumnMenu = true"
        >
          <x-icon small class="mr-1" color="primary">
            mdi-pencil
          </x-icon>
          <span class="caption">
            <!--Edit-->
            {{ $t('general.edit') }}
          </span>
        </v-list-item>
        <v-list-item
          v-t="['column:set-as-primary']"
          dense
          @click="setAsPrimaryValue"
        >
          <x-icon small class="mr-1" color="primary">
            mdi-key-star
          </x-icon>
          <v-tooltip bottom>
            <template #activator="{on}">
              <span class="caption" v-on="on">
                <!--Set as Primary value-->
                {{ $t('activity.setPrimary') }}
              </span>
            </template>
            <span class="caption font-weight-bold">Primary value will be shown in place of primary key</span>
          </v-tooltip>
        </v-list-item>
        <v-list-item
          class="nc-column-delete"
          @click="columnDeleteDialog = true"
        >
          <x-icon small class="mr-1" color="error">
            mdi-delete-outline
          </x-icon>
          <span class="caption">
            <!--Delete-->
            {{ $t('general.delete') }}
          </span>
        </v-list-item>
      </v-list>
    </v-menu>

    <v-menu v-model="editColumnMenu" z-index="999" offset-y content-class="" left>
      <template #activator="{on}">
        <span v-on="on" />
      </template>
      <edit-column
        v-if="editColumnMenu"
        :meta="meta"
        :sql-ui="sqlUi"
        :nodes="nodes"
        :edit-column="true"
        :column="column"
        :column-index="columnIndex"
        @onRelationDelete="$emit('onRelationDelete')"
        @saved="(_cn,_cno) => $emit('saved',_cn,_cno)"
        @close="editColumnMenu = false"
      />
    </v-menu>

    <v-dialog
      v-model="columnDeleteDialog"
      max-width="500"
      persistent
      @keydown.esc="columnDeleteDialog = false"
      @keydown.enter="deleteColumn"
    >
      <v-card class="nc-delete-dialog-card">
        <v-card-title class="grey darken-2 subheading white--text">
          Confirm
        </v-card-title>
        <v-divider />
        <v-card-text class="mt-4 title">
          Do you want to delete <span class="font-weight-bold">'{{
            column.title
          }}'</span> column ?
        </v-card-text>
        <v-divider />
        <v-card-actions class="d-flex pa-4">
          <v-spacer />
          <v-btn
            v-t="['column:delete:cancel']"
            small
            @click="columnDeleteDialog = false"
          >
            <!-- Cancel -->
            {{ $t('general.cancel') }}
          </v-btn>
          <v-btn
            v-t="['column:delete']"
            small
            color="error"
            @click="deleteColumn"
          >
            Confirm
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>

<script>
import cell from '@/components/project/spreadsheet/mixins/cell'
import EditColumn from '@/components/project/spreadsheet/components/editColumn'

export default {
  name: 'HeaderCell',
  components: { EditColumn },
  mixins: [cell],
  props: ['value', 'column', 'isForeignKey', 'meta', 'nodes', 'columnIndex', 'isForm', 'isPublicView', 'isVirtual', 'required', 'isLocked'],
  data: () => ({
    editColumnMenu: false,
    columnDeleteDialog: false
  }),
  methods: {
    async deleteColumn() {
      try {
        const column = { ...this.column, cno: this.column.column_name }
        column.altered = 4
        const columns = this.meta.columns.slice()
        columns[this.columnIndex] = column
        await this.$api.dbTableColumn.delete(this.meta.id, column.id)

        this.$emit('colDelete')
        this.$emit('saved')
        this.columnDeleteDialog = false
      } catch (e) {
        console.log(e)
      }
    },
    async setAsPrimaryValue() {
      // todo: pass only updated fields
      try {
        await this.$api.dbTableColumn.primaryColumnSet(this.meta.id, this.column.id)
        this.$toast.success('Successfully updated as primary column').goAway(3000)
      } catch (e) {
        console.log(e)
        this.$toast.error('Failed to update primary column').goAway(3000)
      }
      this.$emit('saved')
      this.columnDeleteDialog = false
    }
  }
}
</script>

<style scoped>
.name {
  max-width: calc(100% - 40px);
  overflow: hidden;
  text-overflow: ellipsis;
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
