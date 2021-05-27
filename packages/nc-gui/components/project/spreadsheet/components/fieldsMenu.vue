<template>
  <v-menu offset-y>
    <template v-slot:activator="{ on, attrs }">
      <v-badge
        :value="isAnyFieldHidden"
        color="primary"
        dot
        overlap
      >
        <v-btn :disabled="isLocked" outlined v-on="on" small text
               :class=" { 'primary lighten-5 grey--text text--darken-3' : isAnyFieldHidden}">
          <v-icon small class="mr-1" color="#777">mdi-eye-off-outline</v-icon>
          Fields
          <v-icon small color="#777">mdi-menu-down</v-icon>
        </v-btn>
      </v-badge>
    </template>

    <v-list dense class="pt-0" @click.stop min-width="280">

      <v-list-item dense class="">
        <v-text-field dense flat
                      class="caption mt-3 mb-2"
                      color="grey" placeholder="Search fields" @click.stop hide-details v-model="fieldFilter">
          <!--          <template v-slot:prepend-inner>
                      <v-icon small color="grey" class="mt-2">
                        mdi-magnify
                      </v-icon>
                    </template>-->

        </v-text-field>
      </v-list-item>
      <draggable v-model="fieldsOrderLoc" @start="drag=true" @end="drag=false">
        <v-list-item dense v-for="field in fieldsOrderLoc"
                     v-if="field.toLowerCase().indexOf(fieldFilter.toLowerCase()) > -1" :key="field">



          <v-checkbox @click.stop class="mt-0 pt-0" dense
                      v-model="showFields[field]" hide-details>
            <template v-slot:label>
              <span class="caption">{{ field }}</span>
            </template>
          </v-checkbox>
          <v-spacer></v-spacer>
          <v-icon small color="grey" class="align-self-center drag-icon">mdi-drag</v-icon>
        </v-list-item>
      </draggable>

      <v-divider class="my-2"></v-divider>

      <v-list-item dense>

        <v-checkbox @click.stop class="mt-0 pt-0" dense
                    v-model="showSystemFieldsLoc" hide-details>
          <template v-slot:label>
            <span class="caption">Show System Fields</span>
          </template>
        </v-checkbox>
      </v-list-item>
      <v-list-item dense class="mt-2 list-btn mb-3">
        <v-btn small class="elevation-0 grey--text" @click.stop="showAll">Show All</v-btn>
        <v-btn small class="elevation-0 grey--text" @click.stop="hideAll">Hide All</v-btn>
      </v-list-item>

    </v-list>
  </v-menu>


</template>

<script>
import draggable from 'vuedraggable'

export default {
  components: {
    draggable
  },
  name: "fieldsMenu",
  data: () => ({
    fieldFilter: '',
    showFields: {},
    fieldsOrderLoc: []
  }),
  props: {
    sqlUi: [Object, Function],
    meta: Object,
    fieldsOrder: [Array],
    value: [Object, Array],
    fieldList: [Array, Object],
    showSystemFields: {
      type: Boolean,
      default: false
    },
    isLocked: Boolean
  },
  created() {
    this.showFields = this.value;
    this.fieldsOrderLoc = this.fieldsOrder;
  },
  computed: {
    columnMeta() {
      return this.meta && this.meta.columns ? this.meta.columns.reduce((o, c) => ({...o, [c._cn]: c}), {}) : {};
    },

    isAnyFieldHidden() {
      return Object.values(this.showFields).some(v => !v);
    },
    showSystemFieldsLoc: {
      get() {
        return this.showSystemFields;
      }, set(v) {
        this.$emit('update:showSystemFields', v)
      }
    }
  }, watch: {
    fieldList(f) {
      this.fieldsOrderLoc = [...f];
    },
    showFields: {
      handler(v) {
        this.$emit('input', v)
      },
      deep: true
    },
    value(v) {
      this.showFields = v || [];
    },
    fieldsOrder(n, o) {
      if ((n && n.join()) !== (o && o.join())) {
        this.fieldsOrderLoc = n;
      }
    },
    fieldsOrderLoc: {
      handler(n, o) {
        if ((n && n.join()) !== (o && o.join())) {
          this.$emit('update:fieldsOrder', n)
        }
      },
      deep: true
    }
  },
  methods: {
    showAll() {
      this.showFields = Object.keys(this.showFields).reduce((o, k) => (o[k] = true, o), {})
    },
    hideAll() {
      this.showFields = Object.keys(this.showFields).reduce((o, k) => (o[k] = false, o), {})
    }
  }
}
</script>

<style scoped>
/deep/ .v-list-item {
  min-height: 30px;
}

/deep/ .v-input--checkbox .v-icon {
  font-size: 12px !important;
}

.drag-icon{
  cursor: all-scroll;
  /*cursor: grab;*/
}
</style>
