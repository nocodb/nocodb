<template>
  <v-menu offset-y>
    <template #activator="{ on }">
      <v-badge
        :value="isAnyFieldHidden"
        color="primary"
        dot
        overlap
      >
        <v-btn
          class="nc-fields-menu-btn"
          :disabled="isLocked"
          outlined
          small
          text
          :class=" { 'primary lighten-5 grey--text text--darken-3' : isAnyFieldHidden}"
          v-on="on"
        >
          <v-icon small class="mr-1" color="#777">
            mdi-eye-off-outline
          </v-icon>
          Fields
          <v-icon small color="#777">
            mdi-menu-down
          </v-icon>
        </v-btn>
      </v-badge>
    </template>

    <v-list dense class="pt-0" min-width="280" @click.stop>
      <template v-if="isGallery">
        <div class="pa-2">
          <v-select
            v-model="coverImageFieldLoc"
            label="Cover Image"
            class="caption cover-image"
            dense
            outlined
            :items="attachmentFields"
            item-text="alias"
            item-value="_cn"
            hide-details
            @click.stop
          >
            <template #prepend-inner>
              <v-icon small class="cover-image-icon">
                mdi-image
              </v-icon>
            </template>
          </v-select>
        </div>
        <v-divider />
      </template>

      <v-list-item
        dense
        class=""
      >
        <v-text-field
          v-model="fieldFilter"
          dense
          flat
          class="caption mt-3 mb-2"
          color="grey"
          placeholder="Search fields"
          hide-details
          @click.stop
        >
          <!--          <template v-slot:prepend-inner>
                      <v-icon small color="grey" class="mt-2">
                        mdi-magnify
                      </v-icon>
                    </template>-->
        </v-text-field>
      </v-list-item>
      <draggable v-model="fieldsOrderLoc" @start="drag=true" @end="drag=false">
        <template
          v-for="field in fieldsOrderLoc"
        >
          <v-list-item
            v-if="field && field.toLowerCase().indexOf(fieldFilter.toLowerCase()) > -1"
            :key="field"
            dense
          >
            <v-checkbox
              v-model="showFields[field]"
              class="mt-0 pt-0"
              dense
              hide-details
              @click.stop
            >
              <template #label>
                <span class="caption">{{ field }}</span>
              </template>
            </v-checkbox>
            <v-spacer />
            <v-icon small color="grey" class="align-self-center drag-icon">
              mdi-drag
            </v-icon>
          </v-list-item>
        </template>
      </draggable>

      <v-divider class="my-2" />

      <v-list-item dense>
        <v-checkbox
          v-model="showSystemFieldsLoc"
          class="mt-0 pt-0"
          dense
          hide-details
          @click.stop
        >
          <template #label>
            <span class="caption">Show System Fields</span>
          </template>
        </v-checkbox>
      </v-list-item>
      <v-list-item dense class="mt-2 list-btn mb-3">
        <v-btn small class="elevation-0 grey--text" @click.stop="showAll">
          Show All
        </v-btn>
        <v-btn small class="elevation-0 grey--text" @click.stop="hideAll">
          Hide All
        </v-btn>
      </v-list-item>
    </v-list>
  </v-menu>
</template>

<script>
import draggable from 'vuedraggable'

export default {
  name: 'FieldsMenu',
  components: {
    draggable
  },
  props: {
    coverImageField: String,
    isGallery: Boolean,
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
  data: () => ({
    fieldFilter: '',
    showFields: {},
    fieldsOrderLoc: []
  }),
  computed: {
    attachmentFields() {
      return [...(this.meta && this.meta.columns ? this.meta.columns.filter(f => f.uidt === 'Attachment') : []), {
        alias: 'None',
        _cn: ''
      }]
    },
    coverImageFieldLoc: {
      get() {
        return this.coverImageField
      },
      set(val) {
        this.$emit('update:coverImageField', val)
      }
    },
    columnMeta() {
      return this.meta && this.meta.columns ? this.meta.columns.reduce((o, c) => ({ ...o, [c._cn]: c }), {}) : {}
    },

    isAnyFieldHidden() {
      return Object.values(this.showFields).some(v => !v)
    },
    showSystemFieldsLoc: {
      get() {
        return this.showSystemFields
      },
      set(v) {
        this.$emit('update:showSystemFields', v)
      }
    }
  },
  watch: {
    fieldList(f) {
      this.fieldsOrderLoc = [...f]
    },
    showFields: {
      handler(v) {
        this.$emit('input', v)
      },
      deep: true
    },
    value(v) {
      this.showFields = v || []
    },
    fieldsOrder(n, o) {
      if ((n && n.join()) !== (o && o.join())) {
        this.fieldsOrderLoc = n
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
  created() {
    this.showFields = this.value
    this.fieldsOrderLoc = this.fieldsOrder
  },
  methods: {
    showAll() {
      // eslint-disable-next-line no-return-assign,no-sequences
      this.showFields = Object.keys(this.showFields).reduce((o, k) => (o[k] = true, o), {})
    },
    hideAll() {
      // eslint-disable-next-line no-return-assign,no-sequences
      this.showFields = Object.keys(this.showFields).reduce((o, k) => (o[k] = false, o), {})
    }
  }
}
</script>

<style scoped lang="scss">
::v-deep {
  .v-list-item {
    min-height: 30px;
  }

  .v-input--checkbox .v-icon {
    font-size: 12px !important;
  }

  .cover-image {
    .v-input__append-inner {
      margin-top: 4px !important;
    }

    .v-input__slot {
      min-height: 25px !important;
    }

    &.v-input input {
      max-height: 20px !important;
    }

    .cover-image-icon{
      margin-top: 2px;
    }
  }
}

.drag-icon {
  cursor: all-scroll; /*cursor: grab;*/
}

</style>
