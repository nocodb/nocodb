<template>
  <div class="d-flex">
    <div class="d-flex align-center img-container flex-grow-1 hm-items">
      <template v-if="value">
        <v-chip
          small
          v-for="(v,i) in value.map(v=>Object.values(v)[1])"
          :color="colors[i%colors.length]" :key="i">
          {{ v }}
        </v-chip>
      </template>
    </div>
    <div class=" align-center justify-center px-1 flex-shrink-1" :class="{'d-none': !active, 'd-flex':active }">
      <x-icon small :color="['primary','grey']" @click="showNewRecordModal">mdi-plus</x-icon>
      <x-icon x-small :color="['primary','grey']" @click="showChildListModal" class="ml-2">mdi-arrow-expand</x-icon>
    </div>

 <!--   <list-items
      :count="10"
      :meta="childMeta"
      :primary-col="childPrimaryCol"
      :primary-key="childPrimaryKey"
      v-model="newRecordModal"
      :api="childApi"
    ></list-items>-->
    <v-dialog v-if="newRecordModal" v-model="newRecordModal" width="600">
      <v-card width="600" color="backgroundColor">
        <v-card-title class="textColor--text mx-2">Add Record
          <v-spacer>
          </v-spacer>

          <v-btn small class="caption" color="primary">
            <v-icon small>mdi-plus</v-icon>&nbsp;
            Add New Record
          </v-btn>
        </v-card-title>
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
                v-for="(ch,i) in list.list"
                class="ma-2  child-card"
                outlined
                v-ripple
                @click="addChildToParent(ch)"
                :key="i"
              >
                <v-card-title class="primary-value textColor--text text--lighten-2">{{ ch[childPrimaryCol] }}
                  <span class="grey--text caption primary-key"
                        v-if="childPrimaryKey">(Primary Key : {{ ch[childPrimaryKey] }})</span>
                </v-card-title>
              </v-card>


            </template>
          </div>
        </v-card-text>
        <v-card-actions class="justify-center py-2  flex-column">

          <pagination
            v-if="list"
            :size="listPagination.size"
            :count="list.count"
            v-model="listPagination.page"
            @input="showNewRecordModal"
            class="mb-3"
          ></pagination>
        </v-card-actions>
      </v-card>
    </v-dialog>


    <v-dialog v-if="childListModal" v-model="childListModal" width="600">
      <v-card width="600" color="backgroundColor">
        <v-card-title class="textColor--text mx-2">{{ childMeta ? childMeta._tn : 'Children' }}
          <v-spacer>
          </v-spacer>

          <v-btn small class="caption" color="primary" @click="showNewRecordModal">
            <v-icon small>mdi-plus</v-icon>&nbsp;
            Add Record
          </v-btn>

        </v-card-title>
        <v-card-text>

          <div class="items-container">
            <template v-if="childList">
              <v-card
                v-for="(ch,i) in childList.list"
                class="ma-2 child-list-modal child-card"
                outlined
                :key="i"
                @click="editChild(ch)"
              >
                <div class="remove-child-icon d-flex align-center">
                  <x-icon
                    :tooltip="`Unlink this '${childMeta._tn}' from '${meta._tn}'`"
                    :color="['error','grey']"
                    small
                    @click.stop="unlinkChild(ch,i)"
                    icon.class="mr-1 mt-n1"
                  >mdi-link-variant-remove
                  </x-icon>
                  <x-icon
                    :tooltip="`Delete row in '${childMeta._tn}'`"
                    :color="['error','grey']"
                    small
                    @click.stop="deleteChild(ch,i)"
                  >mdi-delete-outline
                  </x-icon>
                </div>

                <v-card-title class="primary-value textColor--text text--lighten-2">{{ ch[childPrimaryCol] }}
                  <span class="grey--text caption primary-key"
                        v-if="childPrimaryKey">(Primary Key : {{ ch[childPrimaryKey] }})</span>
                </v-card-title>
              </v-card>
            </template>
          </div>
        </v-card-text>
        <v-card-actions class="justify-center py-2 flex-column">
          <pagination
            v-if="childList"
            :size="childListPagination.size"
            :count="childList.count"
            v-model="childListPagination.page"
            @input="showChildListModal"
            class="mb-3"
          ></pagination>
        </v-card-actions>
      </v-card>
    </v-dialog>


    <dlg-label-submit-cancel
      type="primary"
      v-if="dialogShow"
      :actionsMtd="confirmAction"
      :dialogShow="dialogShow"
      :heading="confirmMessage"
    >
    </dlg-label-submit-cancel>

    <v-dialog
      :overlay-opacity="0.8"
      v-if="selectedChild"
      width="1000px"
      max-width="100%"
      class=" mx-auto"
      v-model="showExpandModal">
      <component
        v-if="selectedChild"
        :is="form"
        :db-alias="nodes.dbAlias"
        :has-many="childMeta.hasMany"
        :belongs-to="childMeta.belongsTo"
        @cancel="selectedChild = null"
        @input="$emit('loadTableData');showChildListModal();"
        :table="childMeta.tn"
        v-model="selectedChild"
        :old-row="{...selectedChild}"
        :meta="childMeta"
        :sql-ui="sqlUi"
        :primary-value-column="childPrimaryCol"
        :api="childApi"
        :available-columns="childAvailableColumns"
        icon-color="warning"
        :nodes="nodes"
        :query-params="childQueryParams"
      ></component>
      {{childQueryParams}}

    </v-dialog>

  </div>
</template>

<script>
import colors from "@/mixins/colors";
import ApiFactory from "@/components/project/spreadsheet/apis/apiFactory";
import DlgLabelSubmitCancel from "@/components/utils/dlgLabelSubmitCancel";
import Pagination from "@/components/project/spreadsheet/components/pagination";

export default {
  name: "has-many-cell",
  components: {
    Pagination,
    DlgLabelSubmitCancel
  },
  mixins: [colors],
  props: {
    value: [Object, Array],
    meta: [Object],
    hm: Object,
    nodes: [Object],
    row: [Object],
    sqlUi: [Object, Function],
    active: Boolean
  },
  data: () => ({
    newRecordModal: false,
    childListModal: false,
    childMeta: null,
    list: null,
    childList: null,
    dialogShow: false,
    confirmAction: null,
    confirmMessage: '',
    selectedChild: null,
    showExpandModal: false,
    listPagination: {
      page: 1,
      size: 10
    },
    childListPagination: {
      page: 1,
      size: 10
    }
  }),

  methods: {
    async showChildListModal() {
      this.childListModal = true;
      await this.getChildMeta();
      const pid = this.meta.columns.filter((c) => c.pk).map(c => this.row[c._cn]).join('___');
      const _cn = this.childMeta.columns.find(c => c.cn === this.hm.cn)._cn;
      this.childList = await this.childApi.paginatedList({
        where: `(${_cn},eq,${pid})`,
        limit: this.childListPagination.size,
        offset: this.childListPagination.size * (this.childListPagination.page - 1),
        ...this.childQueryParams
      })
    },
    async deleteChild(child) {
      this.dialogShow = true;
      this.confirmMessage =
        'Do you want to delete the record?';
      this.confirmAction = async act => {
        if (act === 'hideDialog') {
          this.dialogShow = false;
        } else {
          const id = this.childMeta.columns.filter((c) => c.pk).map(c => child[c._cn]).join('___');
          await this.childApi.delete(id)
          this.showChildListModal();
          this.dialogShow = false;
          this.$emit('loadTableData')
        }
      }
    },
    async unlinkChild(child) {
      // todo:
      // this.dialogShow = true;
      // this.confirmMessage =
      //   'Do you want to delete the record?';
      // this.confirmAction = async act => {
      //   if (act === 'hideDialog') {
      //     this.dialogShow = false;
      //   } else {
      //     const id = this.childMeta.columns.filter((c) => c.pk).map(c => child[c._cn]).join('___');
      //     await this.childApi.delete(id)
      //     this.showChildListModal();
      //     this.dialogShow = false;
      //     this.$emit('loadTableData')
      //   }
      // }
    },
    async getChildMeta() {
      // todo: optimize
      if (!this.childMeta) {
        const childTableData = await this.$store.dispatch('sqlMgr/ActSqlOp', [{
          env: this.nodes.env,
          dbAlias: this.nodes.dbAlias
        }, 'tableXcModelGet', {
          tn: this.hm.tn
        }]);
        this.childMeta = JSON.parse(childTableData.meta);
        // this.childQueryParams = JSON.parse(childTableData.query_params);
      }
    },
    async showNewRecordModal() {
      this.newRecordModal = true;
      await this.getChildMeta();
      this.list = await this.childApi.paginatedList({
        limit: this.listPagination.size,
        offset: this.listPagination.size * (this.listPagination.page - 1)
      })
    },
    async addChildToParent(child) {
      const id = this.childMeta.columns.filter((c) => c.pk).map(c => child[c._cn]).join('___');
      const pid = this.meta.columns.filter((c) => c.pk).map(c => this.row[c._cn]).join('___');
      const _cn = this.childMeta.columns.find(c => c.cn === this.hm.cn)._cn;
      this.newRecordModal = false;

      await this.childApi.update(id, {
        [_cn]: pid
      }, {
        [_cn]: child[this.childPrimaryKey]
      });

      this.$emit('loadTableData')
      if(this.childListModal){
        await this.showChildListModal()
      }
    },
    async editChild(child) {
      this.selectedChild = child;
      this.showExpandModal = true;
    }
  },
  computed: {
    childApi() {
      return this.childMeta && this.childMeta._tn ?
        ApiFactory.create(this.$store.getters['project/GtrProjectType'],
          this.childMeta && this.childMeta._tn, this.childMeta && this.childMeta.columns, this) : null;
    },
    childPrimaryCol() {
      return this.childMeta && (this.childMeta.columns.find(c => c.pv) || {})._cn
    },
    childPrimaryKey() {
      return this.childMeta && (this.childMeta.columns.find(c => c.pk) || {})._cn
    },
    // todo:
    form() {
      return () => import("@/components/project/spreadsheet/components/expandedForm")
    },
    childAvailableColumns() {
      const hideCols = ['created_at', 'updated_at'];
      if (!this.childMeta) return [];

      const columns = [];
      if (this.childMeta.columns) {
        columns.push(...this.childMeta.columns.filter(c => !(c.pk && c.ai) && !hideCols.includes(c.cn)))
      }
      if (this.childMeta.v) {
        columns.push(...this.childMeta.v.map(v => ({...v, virtual: 1})));
      }
      return columns;
    },
    childQueryParams() {
      if (!this.childMeta) return {}
      return {
        childs: (this.childMeta && this.childMeta.hasMany && this.childMeta.hasMany.map(hm => hm.tn).join()) || '',
        parents: (this.childMeta && this.childMeta.belongsTo && this.childMeta.belongsTo.map(hm => hm.rtn).join()) || '',
        many: (this.childMeta && this.childMeta.manyToMany && this.childMeta.manyToMany.map(mm => mm.rtn).join()) || ''
      }
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
  //min-width: 200px;
  //max-width: 400px;
  flex-wrap: wrap;
  row-gap: 3px;
  gap: 3px;
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
