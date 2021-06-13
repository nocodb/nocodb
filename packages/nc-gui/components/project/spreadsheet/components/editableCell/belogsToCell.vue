<template>
  <div class="d-flex">
    <div class="d-flex align-center img-container flex-grow-1 hm-items">
      <template v-if="value">
        <v-chip small  :color="colors[0]">{{
            Object.values(value)[1]
          }}
        </v-chip>
      </template>
    </div>
    <div class="d-flex align-center justify-center px-1 flex-shrink-1">
      <x-icon small :color="['primary','grey']" @click="showNewRecordModal">mdi-plus</x-icon>
    </div>


    <v-dialog v-if="newRecordModal" v-model="newRecordModal" width="600">
      <v-card width="600" color="backgroundColor">
        <v-card-title class="textColor--text mx-2">Add Record</v-card-title>
        <v-card-text>
          <v-text-field
            hide-details
            dense
            outlined
            placeholder="Search record"
            class="mb-2 mx-2 caption"
          />

          <div class="items-container">
            <template v-if="list">
              <v-card
                v-for="(p,i) in list.list"
                class="ma-2  child-card"
                outlined
                v-ripple
                @click="addParentToChild(p)"
                :key="i"
              >
                <v-card-title class="primary-value textColor--text text--lighten-2">{{ p[parentPrimaryCol] }}
                  <span class="grey--text caption primary-key"
                        v-if="parentPrimaryKey">(Primary Key : {{ p[parentPrimaryKey] }})</span>
                </v-card-title>
              </v-card>
            </template>
          </div>
        </v-card-text>
        <v-card-actions class="justify-center pb-6  ">
          <v-btn small outlined class="caption" color="primary">
            <v-icon>mdi-plus</v-icon>
            Add New Record
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>




  </div>
</template>

<script>
import colors from "@/mixins/colors";
import ApiFactory from "@/components/project/spreadsheet/apis/apiFactory";
import DlgLabelSubmitCancel from "@/components/utils/dlgLabelSubmitCancel";

export default {
  name: "belongs-to-cell",
  mixins: [colors],
  props: {
    value: [Object, Array],
    meta: [Object],
    bt: Object,
    nodes: [Object],
    row: [Object],
    api: [Object, Function],
  },
  data: () => ({
    newRecordModal: false,
    parentListModal: false,
    parentMeta: null,
    list: null,
    childList: null,
    dialogShow: false,
    confirmAction: null,
    confirmMessage: ''
  }),

  methods: {
    async showParentListModal() {
      this.parentListModal = true;
      await this.getParentMeta();
      const pid = this.meta.columns.filter((c) => c.pk).map(c => this.row[c._cn]).join(',');
      const _cn = this.parentMeta.columns.find(c => c.cn === this.hm.cn)._cn;
      this.childList = await this.parentApi.paginatedList({
        where: `(${_cn},eq,${pid})`
      })
    },
    async removeChild(child) {
      this.dialogShow = true;
      this.confirmMessage =
        'Do you want to delete the record?';
      this.confirmAction = async act => {
        if (act === 'hideDialog') {
          this.dialogShow = false;
        } else {
          const id = this.parentMeta.columns.filter((c) => c.pk).map(c => child[c._cn]).join(',');
          await this.parentApi.delete(id)
          this.showParentListModal();
          this.dialogShow = false;
          this.$emit('loadTableData')
        }
      }
    },
    async getParentMeta() {
      // todo: optimize
      if (!this.parentMeta) {
        const parentTableData = await this.$store.dispatch('sqlMgr/ActSqlOp', [{
          env: this.nodes.env,
          dbAlias: this.nodes.dbAlias
        }, 'tableXcModelGet', {
          tn: this.bt.rtn
        }]);
        this.parentMeta = JSON.parse(parentTableData.meta)
      }
    },
    async showNewRecordModal() {
      this.newRecordModal = true;
      await this.getParentMeta();
      this.list = await this.parentApi.paginatedList({})
    },
    async addParentToChild(parent) {
      const pid = this.parentMeta.columns.filter((c) => c.pk).map(c => parent[c._cn]).join(',');
      const id = this.meta.columns.filter((c) => c.pk).map(c => this.row[c._cn]).join(',');
      const _cn = this.meta.columns.find(c => c.cn === this.bt.cn)._cn;

      await this.api.update(id, {
        [_cn]: pid
      }, {
        [_cn]: parent[this.parentPrimaryKey]
      });
      this.newRecordModal = false;

      this.$emit('loadTableData')
    }
  },
  computed: {
    parentApi() {
      return this.parentMeta && this.parentMeta._tn ?
        ApiFactory.create(this.$store.getters['project/GtrProjectType'],
          this.parentMeta && this.parentMeta._tn, this.parentMeta && this.parentMeta.columns, this) : null;
    },
    parentPrimaryCol() {
      return this.parentMeta && (this.parentMeta.columns.find(c => c.pv) || {})._cn
    },
    parentPrimaryKey() {
      return this.parentMeta && (this.parentMeta.columns.find(c => c.pk) || {})._cn
    }
  }
}
</script>

<style scoped lang="scss">
.items-container {
  overflow-x: visible;
  max-height: min(500px, 60vh);
  overflow-y: auto;
}

.primary-value {
  .primary-key {
    display: none;
    margin-left: .5em;
  }

  &:hover .primary-key {
    display: inline;
  }
}


.child-list-modal {
  position: relative;

  .remove-child-icon {
    position: absolute;
    right: 10px;
    top: 10px;
    bottom: 10px;
    opacity: 0;
  }

  &:hover .remove-child-icon {
    opacity: 1;
  }

}

.child-card {
  cursor: pointer;

  &:hover {
    box-shadow: 0 0 .2em var(--v-textColor-lighten5)
  }
}

.hm-items {
  min-width: 200px;
  max-width: 400px;
  flex-wrap: wrap;
  row-gap: 3px;
  gap:3px;
  margin: 3px auto;
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
