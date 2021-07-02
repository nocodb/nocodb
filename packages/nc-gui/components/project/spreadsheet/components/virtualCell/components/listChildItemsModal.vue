<template>
  <v-dialog v-model="show" width="600">
    <list-child-items
      v-if="show"
      ref="child"
      :local-state="localState"
      :is-new="isNew"
      :size="10"
      :meta="meta"
      :parent-meta="meta"
      :primary-col="primaryCol"
      :primary-key="primaryKey"
      :api="api"
      :query-params="queryParams"
      v-bind="$attrs"
      v-on="$listeners"

    />
  </v-dialog>

</template>

<script>
import Pagination from "@/components/project/spreadsheet/components/pagination";
import ListChildItems from "@/components/project/spreadsheet/components/virtualCell/components/listChildItems";

export default {
  name: "listChildItemsModal",
  components: {ListChildItems, Pagination},
  props: {
    localState: Array,
    isNew: Boolean,
    value: Boolean,
    title: {
      type: String,
      default: 'Link Record'
    },
    queryParams: {
      type: Object,
      default() {
        return {};
      }
    },
    primaryKey: String,
    primaryCol: String,
    meta: Object,
    parentMeta: Object,
    size: Number,
    api: [Object, Function],
    mm: [Object, Boolean]
  },
  data: () => ({
    data: null,
    page: 1
  }),
  mounted() {
  },
  methods: {
    async loadData() {
      if (this.$refs && this.$refs.child) {
        this.$refs.child.loadData();
      }
    }
  },
  computed: {
    show: {
      set(v) {
        this.$emit('input', v)
      }, get() {
        return this.value;
      }
    }
  }
}
</script>

<style scoped lang="scss">

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
