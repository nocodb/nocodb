<template>
  <v-dialog v-model="dialogShow" width="60%">
    <v-card>
      <h5 class="body-1 pa-1 text-center">Paste JSON/JSON5 String</h5>

      <div class="d-flex" style="height: 100%; width: 100%">
        <div style="" class="text-center flex-shrink-1 d-flex flex-column">
          <x-icon icon-class="mx-2 mt-3 elevation-1" color="success success" @click="$emit('load', jsonContent)">
            mdi-send
          </x-icon>
        </div>
        <div class="flex-grow-1" style="overflow: auto; height: 100%">
          <monaco-json-editor
            v-model="jsonContent"
            :validate="false"
            lang="json"
            style="height: 500px; width: 100%; min-width: 250px"
          />
        </div>
      </div>
    </v-card>
  </v-dialog>
</template>

<script>
import { MonacoJsonEditor } from '../../../monaco/index';

export default {
  name: 'JsonToColumn',
  directives: {},
  components: { MonacoJsonEditor },
  validate({ params }) {
    return true;
  },
  props: {
    value: Boolean,
    show: Boolean,
  },
  data() {
    return {
      jsonContent: JSON.stringify({ first_name: 'James', last_name: 'Bond' }, 0, 2),
      activeTab: 0,
    };
  },
  head() {
    return {};
  },
  computed: {
    dialogShow: {
      get() {
        return this.show;
      },
      set(val) {
        this.$emit('update:show', val);
      },
    },
  },
  watch: {},
  created() {},
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
