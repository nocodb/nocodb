<template>
  <v-container fluid>
    <v-simple-table class="ignore-height-style params-table" style="" dense>
      <template v-slot:default>
        <thead>
        <tr>
          <th class="text-left caption" width="5%"></th>
          <th class="text-left caption grey--text" width="40%">Param Name</th>
          <th class="text-left caption grey--text" width="40%">Value</th>
          <th class="text-left caption" width="5%"></th>
        </tr>
        </thead>
        <!--        <tbody>-->
        <draggable v-if="value" v-model="paramList" tag="tbody">
          <tr v-for="(item,i) in paramList" :key="i">

            <td>
              <v-checkbox
                v-ge="['api-client-params','enable']"
                small
                class="mt-0 caption"
                color="primary lighten-1"
                hide-details
                v-model="item.enabled" dense></v-checkbox>
            </td>
            <td>

              <xAutoComplete
                class="body-2 caption"
                :disabled="!item.enabled"
                v-model="item.name"
                @input="() => { if(i === value.length - 1 && item.name.length) value.push({name:'',value:'',
          enabled:true}) }"
                placeholder="Key"
                hide-details
                single-line
                dense
                :env="env"
              ></xAutoComplete>
            </td>
            <td style="height: auto">
              <xAutoComplete
                class="body-2 caption"
                v-model="item.value"
                :disabled="!item.enabled"
                :placeholder="item.description || 'Value'"
                hide-details
                single-line
                dense
                :env="env"
              ></xAutoComplete>
            </td>
            <td class="">
              <x-icon
                v-ge="['api-client-params','delete']"
                color="error grey"
                small @click="value.splice(i,1)" tooltip="Delete param">mdi-delete-outline
              </x-icon>
            </td>

          </tr>
        </draggable>
      </template>
    </v-simple-table>
  </v-container>
</template>

<script>

  import draggable from "vuedraggable";


  export default {
    data() {
      return {};
    },
    methods: {},
    computed: {
      paramList: {
        // two way binding(v-model)
        get() {
          return this.value
        },
        set(value) {
          this.$emit('input', value)
        }
      },
    },

    beforeCreated() {
    },
    created() {
      // creating value if not exist
      if (!this.value || !this.value.length) this.$emit('input', [{
        name: '',
        value: '',
        enabled: true
      }]);
    },
    mounted() {
    },
    beforeDestroy() {
    },
    destroy() {
    },
    validate({params}) {
      return true;
    },
    head() {
      return {};
    },
    props: {'value': Array, env: String},
    watch: {
      value: {
        handler(val) {
          // keeps at least one param row
          if (!val || !val.length) this.$emit('input', [{name: '', value: '', enabled: true}]);
        }
      },
    },
    directives: {},
    components: {draggable}
  };
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
