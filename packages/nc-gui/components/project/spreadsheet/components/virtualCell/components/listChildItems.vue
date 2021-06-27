<template>
  <v-dialog v-model="show" width="600">
    <v-card width="600" color="backgroundColor">
      <v-card-title class="textColor--text mx-2">{{ meta ? meta._tn : 'Children' }}
        <v-spacer>
        </v-spacer>

        <v-btn small class="caption" color="primary" @click="$emit('new-record')">
          <v-icon small>mdi-plus</v-icon>&nbsp;
          Add Record
        </v-btn>

      </v-card-title>
      <v-card-text>
        <div class="items-container">
          <template v-if="data && data.list">
            <v-card
              v-for="(ch,i) in data.list"
              class="ma-2 child-list-modal child-card"
              outlined
              :key="i"
              @click="$emit('edit',ch)"
            >
              <div class="remove-child-icon d-flex align-center">
                <x-icon
                  :tooltip="`Unlink this '${meta._tn}' from '${parentMeta._tn}'`"
                  :color="['error','grey']"
                  small
                  @click.stop="$emit('unlink',ch,i)"
                  icon.class="mr-1 mt-n1"
                >mdi-link-variant-remove
                </x-icon>
                <x-icon
                  v-if="!mm"
                  :tooltip="`Delete row in '${meta._tn}'`"
                  :color="['error','grey']"
                  small
                  @click.stop="$emit('delete',ch,i)"
                >mdi-delete-outline
                </x-icon>
              </div>

              <v-card-title class="primary-value textColor--text text--lighten-2">{{ ch[primaryCol] }}
                <span class="grey--text caption primary-key"
                      v-if="primaryKey">(Primary Key : {{ ch[primaryKey] }})</span>
              </v-card-title>
            </v-card>
          </template>
        </div>
      </v-card-text>
      <v-card-actions class="justify-center py-2 flex-column">
        <pagination
          v-if="data && data.list"
          :size="size"
          :count="data.count"
          v-model="page"
          @input="loadData"
          class="mb-3"
        ></pagination>
      </v-card-actions>
    </v-card>
  </v-dialog>

</template>

<script>
import Pagination from "@/components/project/spreadsheet/components/pagination";

export default {
  name: "listChildItems",
  components: {Pagination},
  props: {
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
    mm:[Object, Boolean]
  },
  data: () => ({
    data: null,
    page: 1
  }),
  mounted() {
    this.loadData();
  },
  methods: {
    async loadData() {
      if (!this.api) return;

     this.data = await this.api.paginatedList({
        limit: this.size,
        offset: this.size * (this.page - 1),
        ...this.queryParams
      })
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
