<template>
  <v-dialog v-if="value" v-model="show" width="600">

    <v-card width="600" color="backgroundColor">
      <v-card-title class="textColor--text mx-2">Add Record
        <v-spacer>
        </v-spacer>

        <v-btn small class="caption" color="primary">
          <v-icon small>mdi-plus</v-icon>&nbsp;
          Add New Record
        </v-btn>
      </v-card-title>
      <v-card-text>
        <v-text-field
          hide-details
          dense
          outlined
          placeholder="Search record"
          class="mb-2 mx-2 caption"
        />

        <div class="items-container">
          <template v-if="data">
            <v-card
              v-for="(ch,i) in data.list"
              class="ma-2  child-card"
              outlined
              v-ripple
              @click="$emit('add',ch)"
              :key="i"
            >
              <v-card-title class="primary-value textColor--text text--lighten-2">{{ ch[primaryCol] }}
                <span class="grey--text caption primary-key"
                      v-if="primaryKey">(Primary Key : {{ ch[primaryKey] }})</span>
              </v-card-title>
            </v-card>


          </template>
        </div>
      </v-card-text>
      <v-card-actions class="justify-center py-2  flex-column">

        <pagination
          v-if="list"
          :size="size"
          :count="count"
          v-model="page"
          @input="loadData"
          class="mb-3"
        ></pagination>
      </v-card-actions>
    </v-card>
  </v-dialog>

  <span v-else></span>

</template>

<script>
export default {
  name: "listItems",
  props: {
    value: Boolean,
    title: String,
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
  },
  methods: {
    async loadData() {
      this.data = await this.api.paginatedList({
        limit: this.size,
        offset: this.size * (this.page - 1),
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
  },
  watch: {
    value(v) {
      if (v) {
        this.loadData();
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

</style>
