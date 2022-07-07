<script>
import ListChildItems from '~/components/project/spreadsheet/components/virtualCell/components/ListChildItems'

export default {
  name: 'ListChildItemsModal',
  components: { ListChildItems },
  props: {
    type: String,
    readOnly: Boolean,
    localState: Array,
    isNew: Boolean,
    password: String,
    value: Boolean,
    title: {
      type: String,
      default: 'Link Record',
    },
    queryParams: {
      type: Object,
      default() {
        return {}
      },
    },
    primaryKey: String,
    primaryCol: String,
    meta: Object,
    parentMeta: Object,
    size: Number,
    api: [Object, Function],
    mm: [Object, Boolean],
    isPublic: Boolean,
    rowId: [String, Number],
    column: Object,
  },
  data: () => ({
    data: null,
    page: 1,
  }),
  computed: {
    show: {
      set(v) {
        this.$emit('input', v)
      },
      get() {
        return this.value
      },
    },
  },
  mounted() {},
  methods: {
    async loadData() {
      if (this.$refs && this.$refs.child) {
        this.$refs.child.loadData()
      }
    },
  },
}
</script>

<template>
  <v-dialog v-model="show" width="600" content-class="dialog">
    <v-icon small class="close-icon" @click="$emit('input', false)"> mdi-close </v-icon>
    <ListChildItems
      v-if="show"
      ref="child"
      :type="type"
      :row-id="rowId"
      :local-state="localState"
      :is-new="isNew"
      :size="10"
      :meta="meta"
      :password="password"
      :parent-meta="parentMeta"
      :primary-col="primaryCol"
      :primary-key="primaryKey"
      :api="api"
      :query-params="queryParams"
      v-bind="$attrs"
      :read-only="readOnly"
      :is-public="isPublic"
      :column="column"
      v-on="$listeners"
    />
  </v-dialog>
</template>

<style scoped lang="scss">
::v-deep {
  .dialog {
    position: relative;

    .close-icon {
      width: auto;
      position: absolute;
      right: 10px;
      top: 10px;
      z-index: 9;
    }
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
