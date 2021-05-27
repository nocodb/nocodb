<template>
  <v-skeleton-loader v-if="loading" type="text@3"></v-skeleton-loader>
  <div class="caption" v-else>{{ Array.isArray(value) ? '[' : '{' }}

    <ul>
      <template v-if="Array.isArray(value)">
        <li v-for="(v,i) in value">
          <custom-acl :nodes="nodes" :table="table" v-model="value[i]"></custom-acl>
        </li>
        <li @click="addConditionObj" class="caption add">add +</li>
      </template>
      <template v-else>
        <li v-for="(key,i) in keys" :key="key" v-if="key !== 'relationType'" :class="{empty: !keys[i]}">
          <div class="d-inline">
            <!--      <span contenteditable v-text="key" class="key"></span>-->
            <select class="caption" v-model="keys[i]" :ref="'keySelect'+i" @change="onKeyChange(i,key)">
              <template v-if="table">
                <optgroup label="columns" v-if="columns && columns.length">
                  <option v-for="col in columns" v-show="!keys.includes(col)" :data-value="col">{{ col }}</option>
                </optgroup>
                <optgroup label="Has Many" v-if="hmList && hmList.length">
                  <option v-for="hm in hmList" v-show="!keys.includes(hm)" data-relation-type="hm" :data-table="hm">{{
                      hm
                    }}
                  </option>
                </optgroup>
                <optgroup label="BelongsTo" v-if="btList && btList.length">
                  <option v-for="bt in btList" v-show="!keys.includes(bt)" data-relation-type="bt" :data-table="bt">{{
                      bt
                    }}
                  </option>
                </optgroup>
                <optgroup label="Logical Operators">
                  <option v-for="op in logicOp" data-logical-op="true" :data-op="op">{{ op }}</option>
                </optgroup>
              </template>
              <optgroup label="Comparison Operators" v-else>
                <option v-for="op in compOp" v-show="!keys.includes(op)" :data-op="op">{{ op }}</option>
              </optgroup>
            </select>
            <div class="delete-wrapper">
              <x-icon color="red" icon-class="delete" v-if="typeof value[key] !== 'string'" x-small
                      @click="deleteCondition(key)">
                mdi-delete-outline
              </x-icon>
            </div>
            <span class="separator"> : </span>
          </div>
          <template v-if="typeof value[key] === 'string'"><input type="text" v-model="value[key]"
                                                                 class="value caption"/></template>
          <!--          @input="e => $set(value,key,e.target.innerHTML)"   -->

          <template v-else>
            <span class="caption grey--text" v-if="value[key].relationType">
              {{ `'${table}' ${value[key].relationType === 'bt' ? 'BelongsTo' : 'HasMany'} '${key}'` }}
            </span>
            <custom-acl :nodes="nodes" v-model="value[key]" :table="(value[key].relationType ? key : null)
            || (logicOp.includes(key) ? table : null)"
            ></custom-acl>
          </template>
        </li>
        <li v-if="table" @click="addConditionProp" class="caption add">add +</li>
      </template>
    </ul>
    {{ Array.isArray(value) ? '] ,' : '} ,' }}
  </div>
</template>

<script>


import {insertKey} from "../../../helpers/xutils";

export default {
  name: "custom-acl",
  data: () => ({
    columns: null,
    hmList: null,
    btList: null,
    logicOp: [
      '_and', '_or', '_not'
    ],
    compOp: [
      'eq', 'neq', 'like', 'nlike', 'in', 'gt', 'lt', 'le', 'ge'
    ],
    loading: false
  }),
  methods: {
    onKeyChange(i, key) {
      let value = JSON.parse(JSON.stringify(this.value));

      const selected = this.$refs[`keySelect${i}`][0].selectedOptions;
      let selectedVal = '';
      if (selected && selected[0])
        selectedVal = selected[0].dataset;
      if (selectedVal.value) {
        delete value[key];
        value = insertKey(this.keys[i], {eq: ""}, value, i);
      } else if (selectedVal.relationType === 'hm') {
        delete value[key];
        value = insertKey(selectedVal.table, {
          relationType: "hm",
          "": ""
        }, value, i);
      } else if (selectedVal.relationType === 'bt') {
        delete value[key];
        value = insertKey(selectedVal.table, {
          relationType: "bt",
          "": ""
        }, value, i);
      } else if (selectedVal.op) {
        const oldVal = value[key];
        delete value[key];
        if (selectedVal.logicalOp) {
          if (selectedVal.op === '_not') {
            value = insertKey(selectedVal.op, {
              "": ""
            }, value, i);
          } else {
            value = insertKey(selectedVal.op, [{
              "": ""
            }], value, i);
          }
        } else {
          value[selectedVal.op] = oldVal;
        }
      }
      this.$emit('input', value);
    },
    addConditionProp() {
      const value = JSON.parse(JSON.stringify(this.value));
      value[""] = "";
      this.$emit('input', value);
    },
    addConditionObj() {
      const value = JSON.parse(JSON.stringify(this.value));
      value.push({
        "": ""
      })
      this.$emit('input', value);
    },
    deleteCondition(key) {
      const value = JSON.parse(JSON.stringify(this.value));
      delete value[key];
      this.$emit('input', value);
    },
    async loadTableMetaDetails() {
      if (this.table) {
        this.loading = true;
        try {
          const meta = await this.$store.dispatch('sqlMgr/ActSqlOp', [{
            env: this.nodes.env,
            dbAlias: this.nodes.dbAlias
          }, 'tableXcModelGet', {
            tn: this.table
          }]);
          const metaObj = JSON.parse(meta.meta)
          this.columns = metaObj.columns.map(v => v.cn);
          console.log(metaObj)
          this.hmList = metaObj.hasMany.map(v => v.tn)
          this.btList = metaObj.belongsTo.map(v => v.rtn)

        } catch (e) {
          console.log('load meta', this.table, e);
        } finally {
          this.loading = false;
        }
      }
    }
  },
  props: [
    'value',
    'table',
    'column',
    'nodes'
  ],
  created() {
  },
  async mounted() {
    await this.loadTableMetaDetails();
  },
  computed: {
    keys() {
      return Object.keys(this.value);
    }
  }
}
</script>

<style scoped lang="scss">


.key, .value {
  min-width: 40px;
  border-bottom: 1px dotted #bbbbbb;
  display: inline-block;
}

ul {
  position: relative;
  list-style: none;
  padding-left: 35px;
  overflow: visible;

  li {
    padding: 1px 5px;
  }

  border-left: 1px dotted #bbbbbb;

}

select {
  border-bottom: 1px dotted #bbbbbb;
  -webkit-appearance: listbox;
  -moz-appearance: listbox;
  appearance: listbox;
}

.separator {
  margin: 0 10px;
}

.add {
  font-size: 10px;
}

.empty {
  background: #ddd;
}

.delete-wrapper {
  width: 20px;
  display: inline-block;
}

.delete {
  max-width: 0;
  overflow: hidden;
  //opacity: 0;
  transition: max-width .4s, opacity .4s;
}

div:hover > .delete-wrapper .delete {
  max-width: 20px;
  //opacity: 1;
}


select, input {
  color: var(--v-primary-text);
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
