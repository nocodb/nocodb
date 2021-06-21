<template>
  <v-dialog v-model="show" width="600">
    <v-card width="600" color="backgroundColor">
      <v-card-title class="textColor--text mx-2 justify-center">{{ title }}

      </v-card-title>

      <v-card-title>
        <v-text-field
          hide-details
          dense
          outlined
          placeholder="Search records"
          class=" caption search-field ml-2"
        />
        <v-spacer></v-spacer>
        <v-btn small class="caption mr-2" color="primary" @click="$emit('add-new-record')">
          <v-icon small>mdi-plus</v-icon>&nbsp;
          New Record
        </v-btn>

      </v-card-title>

      <v-card-text>
        <div class="items-container">
          <template v-if="data && data.list && data.list.length">
            <v-card
              v-for="(ch,i) in data.list"
              class="ma-2  child-card"
              outlined
              v-ripple
              @click="$emit('add',ch)"
              :key="i"
            >
              <v-card-text class="primary-value textColor--text text--lighten-2 d-flex">
                <span class="font-weight-bold"> {{ ch[primaryCol] }}&nbsp;</span>
                <span class="grey--text caption primary-key "
                      v-if="primaryKey">(Primary Key : {{ ch[primaryKey] }})</span>
                <v-spacer/>
                <v-chip v-if="hm && ch[meta._tn]" x-small>
                  {{ ch[primaryCol] }}
                </v-chip>
              </v-card-text>
            </v-card>


          </template>

          <div v-else class="text-center py-15 textLight--text">
            No items found
          </div>
        </div>
      </v-card-text>
      <v-card-actions class="justify-center py-2  flex-column">
          <pagination
            v-if="data && data.list && data.list.length"
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
  name: "listItems",
  components: {Pagination},
  props: {
    value: Boolean,
    hm:Boolean,
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
    size: Number,
    api: [Object, Function]
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
      if (this.api) {
        this.data = await this.api.paginatedList({
          limit: this.size,
          offset: this.size * (this.page - 1),
          ...this.queryParams
        })
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

.child-card {
  cursor: pointer;

  &:hover {
    box-shadow: 0 0 .2em var(--v-textColor-lighten5)
  }
}


.primary-value {
  .primary-key {
    display: none;
    margin-left: .5em;
  }

  &:hover .primary-key {
    display: inline;
  }
}
.items-container {
  overflow-x: visible;
  max-height: min(500px, 60vh);
  overflow-y: auto;
}

</style>
