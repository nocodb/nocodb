<!-- eslint-disable -->
<!-- todo: update prop mutation with emit -->
<template>
  <v-container fluid>
    <v-simple-table class="ignore-height-style" dense>
      <template #default>
        <thead>
          <tr>
            <th class="text-left caption" width="5%" />
            <th class="text-left caption">Header Name</th>
            <th class="text-left caption">Value</th>
            <th class="text-left caption" width="5%" />
          </tr>
        </thead>
        <draggable v-if="value" v-model="headersList" tag="tbody">
          <tr v-for="(item, i) in headersList" :key="i">
            <td>
              <v-checkbox
                v-model="item.enabled"
                v-ge="['api-client-headers', 'enable']"
                small
                class="mt-0"
                color="primary lighten-1"
                hide-details
                dense
              />
            </td>
            <td>
              <v-combobox
                v-model="item.name"
                v-ge="['api-client-headers', 'enable']"
                class="body-2 caption nc-input-hook-header-key"
                :items="headerListAuto"
                :disabled="!item.enabled"
                hide-details
                single-line
                dense
                placeholder="Key"
                @update:search-input="
                  e => {
                    if (i === value.length - 1 && e && e.length) value.push({ name: '', value: '', enabled: true });
                  }
                "
              />
            </td>
            <td style="height: auto">
              <xAutoComplete
                v-model="item.value"
                class="body-2 caption nc-input-hook-header-value"
                :disabled="!item.enabled"
                placeholder="Value"
                hide-details
                single-line
                dense
                :env="env"
              />
            </td>
            <td class="">
              <x-icon
                v-ge="['api-client-headers', 'delete']"
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
    return {
      headerListAuto: [
        'A-IM',
        'Accept',
        'Accept-Charset',
        'Accept-Encoding',
        'Accept-Language',
        'Accept-Datetime',
        'Access-Control-Request-Method',
        'Access-Control-Request-Headers',
        'Authorization',
        'Cache-Control',
        'Connection',
        'Content-Length',
        'Content-Type',
        'Cookie',
        'Date',
        'Expect',
        'Forwarded',
        'From',
        'Host',
        'If-Match',
        'If-Modified-Since',
        'If-None-Match',
        'If-Range',
        'If-Unmodified-Since',
        'Max-Forwards',
        'Origin',
        'Pragma',
        'Proxy-Authorization',
        'Range',
        'Referer',
        'TE',
        'User-Agent',
        'Upgrade',
        'Via',
        'Warning',
        'Non-standard headers',
        'Dnt',
        'X-Requested-With',
        'X-CSRF-Token',
      ],
    };
  },
  head() {
    return {};
  },
  computed: {
    headersList: {
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
    // keeps at least one param row
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
