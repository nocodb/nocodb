<template>
  <div class="d-flex">
    <div class="d-flex align-center img-container flex-grow-1 hm-items">
      <template v-if="value">
        <v-chip
          small
          v-for="(v,i) in value.map(v=>Object.values(v)[1])"
          :color="colors[i%colors.length]" :key="j">
          {{ v }}
        </v-chip>
      </template>
    </div>
    <div class="d-flex align-center justify-center px-1 flex-shrink-1">
      <x-icon small :color="['primary','grey']" @click="showNewRecordModal">mdi-plus</x-icon>
      <x-icon x-small :color="['primary','grey']" @click="showChildListModal" class="ml-2">mdi-arrow-expand</x-icon>
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
              >
                <x-icon
                  class="remove-child-icon"
                  :color="['error','grey']"
                  small
                  @click="removeChild(ch,i)"
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
  name: "has-many-cell",
  components: {DlgLabelSubmitCancel},
  mixins: [colors],
  props: {
    value: [Object, Array],
    meta: [Object],
    hm: Object,
    nodes: [Object],
    row: [Object]
  },
  data: () => ({
    newRecordModal: false,
    childListModal: false,
    childMeta: null,
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
      const pid = this.meta.columns.filter((c) => c.pk).map(c => this.row[c._cn]).join(',');
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
          const id = this.childMeta.columns.filter((c) => c.pk).map(c => child[c._cn]).join(',');
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
        const childTableData = await this.$store.dispatch('sqlMgr/ActSqlOp', [{
          env: this.nodes.env,
          dbAlias: this.nodes.dbAlias
        }, 'tableXcModelGet', {
          tn: this.hm.tn
        }]);
        this.childMeta = JSON.parse(childTableData.meta)
      }
    },
    async showNewRecordModal() {
      this.newRecordModal = true;
      await this.getChildMeta();
      this.list = await this.childApi.paginatedList({})
    },
    async addChildToParent(child) {
      const id = this.childMeta.columns.filter((c) => c.pk).map(c => child[c._cn]).join(',');
      const pid = this.meta.columns.filter((c) => c.pk).map(c => this.row[c._cn]).join(',');
      const _cn = this.childMeta.columns.find(c => c.cn === this.hm.cn)._cn;
      this.newRecordModal = false;

      await this.childApi.update(id, {
        [_cn]: pid
      }, {
        [_cn]: child[this.childPrimaryKey]
      });

      this.$emit('loadTableData')
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
