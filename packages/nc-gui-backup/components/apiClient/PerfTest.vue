<template>
  <v-container fluid>
    <v-simple-table dense class="ignore-height-style params-table" style="">
      <template #default>
        <thead>
          <tr>
            <th class="text-left body-2 grey--text" width="40%">Param Name</th>
            <th class="text-left body-2 grey--text" width="40%">Value</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Connections</td>
            <td>
              <v-text-field
                v-model="perf.connections"
                placeholder="Enter a number"
                hide-details
                single-line
                dense
                class="body-2"
                type="number"
                @input="$emit('input', perf)"
              />
            </td>
          </tr>
          <tr>
            <td>Pipeline</td>
            <td>
              <v-text-field
                v-model="perf.pipelining"
                placeholder="Enter a number"
                hide-details
                single-line
                dense
                class="body-2"
                type="number"
                @input="$emit('input', perf)"
              />
            </td>
          </tr>
          <tr>
            <td>Duration</td>
            <td>
              <v-text-field
                v-model="perf.duration"
                placeholder="Duration in seconds"
                hide-details
                single-line
                dense
                class="body-2"
                type="number"
                @input="$emit('input', perf)"
              />
            </td>
          </tr>
        </tbody>
      </template>
    </v-simple-table>
    <div class="pa-1 text-right">
      <p class="grey--text caption">
        We are using
        <a v-ge="['api-client-perf-test', 'autocannon-link']" @click="open('https://github.com/mcollina/autocannon')"
          >autocannon</a
        >
      </p>

      <v-btn v-ge="['api-client-perf-test', 'clear']" outlined x-small color="warning" @click="$emit('input', {})">
        Clear All Fields
      </v-btn>
    </div>
  </v-container>
</template>

<script>
// const {shell} = require("electron").remote.require(
//   "./libs"
// );
export default {
  name: 'PerfTest',
  props: {
    value: Object,
  },
  computed: {
    perf: {
      get() {
        return { ...(this.value || {}) };
      },
      set(value) {
        this.$emit('input', value);
      },
    },
  },
  methods: {
    open(url) {
      // shell.openExternal(url)
    },
  },
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
