<template>
  <!--  <v-dialog v-model="show" width="600">-->
  <v-card width="600" color="">
    <v-card-title v-if="!isForm" class="textColor--text mx-2" :class="{'py-2':isForm}">
      <span v-if="!isForm">{{ meta ? meta._tn : 'Children' }}</span>
      <v-spacer>
      </v-spacer>

      <v-btn
        small
        class="caption"
        color="primary"
        @click="$emit('new-record')"
      >
        <v-icon
          small>mdi-link
        </v-icon>&nbsp;
        Link to '{{ meta._tn }}'
      </v-btn>
    </v-card-title>
    <v-card-text>
      <div class="items-container pt-2 mb-n4">
        <div class="text-right mb-2 mt-n4 mx-2">
          <v-btn
            v-if="isForm"
            x-small
            class="caption"
            color="primary"
            outlined
            @click="$emit('new-record')"
          >
            <v-icon
              x-small>mdi-link
            </v-icon>&nbsp;
            Link to '{{ meta._tn }}'
          </v-btn>
        </div>
        <template v-if="isDataAvail">
          <v-card
            v-for="(ch,i) in ((data && data.list) || localState)"
            class="mx-2 mb-2 child-list-modal child-card"
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
                v-if="!mm && !bt"
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

        <div v-else-if="data || localState" class="text-center  textLight--text"
             :class="{'pt-6 pb-4' : !isForm , 'pt-1':isForm}">
          No item{{ bt ? '' : 's' }} found
        </div>

        <div v-if="isForm" class="mb-2 d-flex align-center justify-center">
          <pagination
            v-if="!bt && isDataAvail && data && data.count > 1"
            :size="size"
            :count="data && data.count"
            v-model="page"
            @input="loadData"
          ></pagination>
        </div>
      </div>
    </v-card-text>
    <v-card-actions v-if="!isForm" class="justify-center flex-column" :class="{'py-0':isForm}">
      <pagination
        v-if="!bt && isDataAvail && data && data.count > 1"
        :size="size"
        :count="data && data.count"
        v-model="page"
        @input="loadData"
        class="mb-3"
      ></pagination>
    </v-card-actions>
  </v-card>
  <!--  </v-dialog>-->

</template>

<script>
import Pagination from "@/components/project/spreadsheet/components/pagination";

export default {
  name: "listChildItems",
  components: {Pagination},
  props: {
    isForm: Boolean,
    bt: Boolean,
    localState: [Array],
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
    this.loadData();
  },
  methods: {
    async loadData() {
      if (!this.api || this.isNew) return;
      this.data = await this.api.paginatedList({
        limit: this.size,
        offset: this.size * (this.page - 1),
        ...this.queryParams
      })
    }
  },
  computed: {
    isDataAvail() {
      return (this.data && this.data.list && this.data.list.length) || (this.localState && this.localState.length);
    },
    show: {
      set(v) {
        this.$emit('input', v)
      }, get() {
        return this.value;
      }
    }
  },
  watch: {
    queryParams() {
      this.loadData();
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
