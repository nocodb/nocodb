<template>
  <div class="d-flex">


    <div class="d-flex align-center img-container flex-grow-1 hm-items">
      <template v-if="value">
        <v-chip small v-for="(v,j) in value.map(v=>Object.values(v)[2])"
                :color="colors[j%colors.length]" :key="j">{{
            v
          }}
        </v-chip>
      </template>
    </div>
    <div class=" align-center justify-center px-1 flex-shrink-1" :class="{'d-none': !active, 'd-flex':active }">
      <x-icon small :color="['primary','grey']" @click="showNewRecordModal">mdi-plus</x-icon>
<!--      <x-icon x-small :color="['primary','grey']" @click="showChildListModal" class="ml-2">mdi-arrow-expand</x-icon>-->
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
                @click="addChildToParent(p)"
                :key="i"
              >
                <v-card-title class="primary-value textColor--text text--lighten-2">{{ p[childPrimaryCol] }}
                  <span class="grey--text caption primary-key"
                        v-if="childPrimaryKey">(Primary Key : {{ p[childPrimaryKey] }})</span>
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


    <v-dialog v-if="childListModal" v-model="childListModal" width="600">
      <v-card width="600" color="backgroundColor">
        <v-card-title class="textColor--text mx-2">{{ childMeta ? childMeta._tn : 'Children' }}</v-card-title>
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
                <x-icon
                  class="remove-child-icon"
                  :color="['error','grey']"
                  small
                  @click.stop="removeChild(ch,i)"
                >mdi-delete-outline
                </x-icon>

                <v-card-title class="primary-value textColor--text text--lighten-2">{{ ch[childPrimaryCol] }}
                  <span class="grey--text caption primary-key"
                        v-if="childPrimaryKey">(Primary Key : {{ ch[childPrimaryKey] }})</span>
                </v-card-title>
              </v-card>
            </template>
          </div>
        </v-card-text>
        <v-card-actions class="justify-center pb-6">
          <v-btn small outlined class="caption" color="primary" @click="showNewRecordModal">
            <v-icon>mdi-plus</v-icon>
            Add Record
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>


    <v-dialog
      :overlay-opacity="0.8"
      v-if="selectedChild"
      width="1000px"
      max-width="100%"
      class=" mx-auto"
      v-model="showExpandModal">
      <expanded-form
        v-if="selectedChild"
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
      ></expanded-form>
    </v-dialog>


    <dlg-label-submit-cancel
      type="primary"
      v-if="dialogShow"
      :actionsMtd="confirmAction"
      :dialogShow="dialogShow"
      :heading="confirmMessage"
    >
    </dlg-label-submit-cancel>
  </div>
</template>

<script>
import colors from "@/mixins/colors";
import ApiFactory from "@/components/project/spreadsheet/apis/apiFactory";
import DlgLabelSubmitCancel from "@/components/utils/dlgLabelSubmitCancel";

export default {
  name: "many-to-many-cell",
  mixins: [colors],
  components: {DlgLabelSubmitCancel},
  props: {
    value: [Object, Array],
    meta: [Object],
    mm: Object,
    nodes: [Object],
    row: [Object],
    api: [Object, Function],
    sqlUi: [Object, Function],
    active: Boolean
  },
  data: () => ({
    newRecordModal: false,
    childListModal: false,
    childMeta: null,
    assocMeta: null,
    list: null,
    childList: null,
    dialogShow: false,
    confirmAction: null,
    confirmMessage: ''
  }),

  methods: {
    async showChildListModal() {
      this.childListModal = true;
      await this.getChildMeta();
      const pid = this.meta.columns.filter((c) => c.pk).map(c => this.row[c._cn]).join('___');
      const _cn = this.childMeta.columns.find(c => c.cn === this.hm.cn)._cn;
      this.childList = await this.childApi.paginatedList({
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
          const id = this.childMeta.columns.filter((c) => c.pk).map(c => child[c._cn]).join('___');
          await this.childApi.delete(id)
          this.showChildListModal();
          this.dialogShow = false;
          this.$emit('loadTableData')
        }
      }
    },
    async getChildMeta() {
      // todo: optimize
      if (!this.childMeta) {
        const parentTableData = await this.$store.dispatch('sqlMgr/ActSqlOp', [{
          env: this.nodes.env,
          dbAlias: this.nodes.dbAlias
        }, 'tableXcModelGet', {
          tn: this.mm.rtn
        }]);
        this.childMeta = JSON.parse(parentTableData.meta)
      }
    },
    async getAssociateTableMeta() {
      // todo: optimize
      if (!this.childMeta) {
        const assocTableData = await this.$store.dispatch('sqlMgr/ActSqlOp', [{
          env: this.nodes.env,
          dbAlias: this.nodes.dbAlias
        }, 'tableXcModelGet', {
          tn: this.mm.vtn
        }]);
        this.assocMeta = JSON.parse(assocTableData.meta)
      }
    },
    async showNewRecordModal() {
      this.newRecordModal = true;
      await Promise.all([this.getChildMeta(), this.getAssociateTableMeta()]);
      this.list = await this.childApi.paginatedList({})
    },
    async addChildToParent(child) {
      const cid = this.childMeta.columns.filter((c) => c.pk).map(c => child[c._cn]).join('___');
      const pid = this.meta.columns.filter((c) => c.pk).map(c => this.row[c._cn]).join('___');

      const vcidCol = this.assocMeta.columns.find(c => c.cn === this.mm.vrcn)._cn;
      const vpidCol = this.assocMeta.columns.find(c => c.cn === this.mm.vcn)._cn;

      await this.assocApi.insert({
        [vcidCol]: cid,
        [vpidCol]: pid
      });
      this.newRecordModal = false;

      this.$emit('loadTableData')
    }
  },
  computed: {
    childApi() {
      return this.childMeta && this.childMeta._tn ?
        ApiFactory.create(
          this.$store.getters['project/GtrProjectType'],
          this.childMeta._tn,
          this.childMeta.columns,
          this
        ) : null;
    },
    assocApi() {
      return this.assocMeta && this.assocMeta._tn ?
        ApiFactory.create(
          this.$store.getters['project/GtrProjectType'],
          this.assocMeta._tn,
          this.assocMeta.columns,
          this
        ) : null;
    },
    childPrimaryCol() {
      return this.childMeta && (this.childMeta.columns.find(c => c.pv) || {})._cn
    },
    childPrimaryKey() {
      return this.childMeta && (this.childMeta.columns.find(c => c.pk) || {})._cn
    },
    parentPrimaryKey() {
      return this.meta && (this.meta.columns.find(c => c.pk) || {})._cn
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
