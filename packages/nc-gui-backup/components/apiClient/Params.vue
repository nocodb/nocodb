<!-- eslint-disable -->
<!-- todo: update prop mutation with emit -->
<template>
  <v-container fluid>
    <v-simple-table class="ignore-height-style params-table" style="" dense>
      <template #default>
        <thead>
          <tr>
            <th class="text-left caption" width="5%" />
            <th class="text-left caption grey--text" width="40%">Param Name</th>
            <th class="text-left caption grey--text" width="40%">Value</th>
            <th class="text-left caption" width="5%" />
          </tr>
        </thead>
        <!--        <tbody>-->
        <draggable v-if="value" v-model="paramList" tag="tbody">
          <tr v-for="(item, i) in paramList" :key="i">
            <td>
              <v-checkbox
                v-model="item.enabled"
                v-ge="['api-client-params', 'enable']"
                small
                class="mt-0 caption"
                color="primary lighten-1"
                hide-details
                dense
              />
            </td>
            <td>
              <xAutoComplete
                v-model="item.name"
                class="body-2 caption"
                :disabled="!item.enabled"
                placeholder="Key"
                hide-details
                single-line
                dense
                :env="env"
                @input="
                  () => {
                    if (i === value.length - 1 && item.name.length) value.push({ name: '', value: '', enabled: true });
                  }
                "
              />
            </td>
            <td style="height: auto">
              <xAutoComplete
                v-model="item.value"
                class="body-2 caption"
                :disabled="!item.enabled"
                :placeholder="item.description || 'Value'"
                hide-details
                single-line
                dense
                :env="env"
              />
            </td>
            <td class="">
              <x-icon
                v-ge="['api-client-params', 'delete']"
                color="error grey"
                small
                tooltip="Delete param"
                @click="value.splice(i, 1)"
              >
                mdi-delete-outline
              </x-icon>
            </td>
          </tr>
        </draggable>
      </template>
    </v-simple-table>
  </v-container>
</template>

<script>
import draggable from 'vuedraggable';

export default {
  directives: {},
  components: { draggable },
  validate({ params }) {
    return true;
  },
  props: { value: Array, env: String },
  data() {
    return {};
  },
  head() {
    return {};
  },
  computed: {
    paramList: {
      // two way binding(v-model)
      get() {
        return this.value;
      },
      set(value) {
        this.$emit('input', value);
      },
    },
  },
  watch: {
    value: {
      handler(val) {
        // keeps at least one param row
        if (!val || !val.length) {
          this.$emit('input', [{ name: '', value: '', enabled: true }]);
        }
      },
    },
  },
  created() {
    // creating value if not exist
    if (!this.value || !this.value.length) {
      this.$emit('input', [
        {
          name: '',
          value: '',
          enabled: true,
        },
      ]);
    }
  },
  mounted() {},
  beforeDestroy() {},
  methods: {},

  beforeCreated() {},
  destroy() {},
};
</script>

<style scoped></style>
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
