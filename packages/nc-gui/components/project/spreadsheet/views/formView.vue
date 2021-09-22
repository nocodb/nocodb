<template>
  <v-container fluid class="h-100 backgroundColor">
    <v-row class="h-100">
      <v-col cols="3">
        <v-card class="h-100 pa-2 backgroundColor elevation-0">
          <div class="d-flex grey--text">
            <span class="">Fields</span>
            <v-spacer />
            <span class="caption mr-2 font-weight-bold" style="border-bottom: 2px solid grey">add all</span>
            <span class="caption font-weight-bold" style="border-bottom: 2px solid grey">remove all</span>
          </div>
          <draggable
            v-model="hiddenColumns"
            draggable=".item"
            group="form-inputs"
            @start="drag=true"
            @end="drag=false"
          >
            <v-card
              v-for="(col) in hiddenColumns"
              :key="col.alias"
              class="pa-2 my-2 item pointer elevation-0"
              @mousedown="moved=false"
              @mousemove="moved=false"
              @mouseup="handleMouseUp(col)"
            >
              <div class="d-flex">
                <label :for="`data-table-form-${col._cn}`" class="body-2 text-capitalize flex-grow-1">
                  <virtual-header-cell
                    v-if="col.virtual"
                    :column="col"
                    :nodes="nodes"
                    :is-form="true"
                    :meta="meta"
                  />
                  <header-cell
                    v-else
                    :is-form="true"
                    :value="col._cn"
                    :column="col"
                    :sql-ui="sqlUi"
                  />

                </label>
                <v-icon color="grey">
                  mdi-drag
                </v-icon>
              </div>
            </v-card>
            <div class="nc-drag-n-drop-to-hide py-3 text-center grey--text text--lighter-1">
              Drag and drop field here to hide
            </div>
          </draggable>
          <div class="grey--text caption text-center mt-4">
            <v-icon samll color="grey">
              mdi-plus
            </v-icon>
            Add new field to this table
          </div>
        </v-card>
      </v-col>
      <v-col class="h-100 px-10 backgroundColor darken-1" style="overflow-y: auto" cols="9">
        <!--        <div class="my-14 d-flex align-center justify-center">-->
        <!--          <v-chip>Add cover image</v-chip>-->
        <!--        </div>-->
        <div class="my-10 d-flex align-center justify-center flex-column">
          <editable
            v-model="localParams.name"
            class="title nc-meta-inputs text-center"
          />

          <editable
            v-model="localParams.description"
            class="caption nc-meta-inputs text-center"
          />
        </div>

        <div style="max-width:600px" class="mx-auto">
          <draggable
            v-model="columns"
            draggable=".item"
            group="form-inputs"
            class="h-100"
            @start="drag=true"
            @end="drag=false"
          >
            <div
              v-for="(col,i) in columns"
              :key="col.alias"
              class="nc-field-wrapper item pa-2"
            >
              <v-overlay
                :value="true"
                absolute
                :color="$store.state.windows.darkTheme ? 'black': 'white'"
                opacity="0.1"
              />
              <v-icon small class="nc-field-remove-icon" @click="columns = columns.filter((_,j) => i !== j)">
                mdi-eye-off-outline
              </v-icon>
              <!--            <v-card-->
              <!--              outlined-->
              <!--              class="pa-2 my-2  "-->
              <!--            >-->
              <div
                v-if="!col.lk"
                :key="i"
                :class="{
                  'active-row' : active === col._cn
                }"
                class="row-col  my-4"
              >
                <div>
                  <label :for="`data-table-form-${col._cn}`" class="body-2  mt-n1 text-capitalize">
                    <virtual-header-cell
                      v-if="col.virtual"
                      :column="col"
                      :nodes="nodes"
                      :is-form="true"
                      :meta="meta"
                    />
                    <header-cell
                      v-else
                      :is-form="true"
                      :value="col._cn"
                      :column="col"
                      :sql-ui="sqlUi"
                    />

                  </label>
                  <virtual-cell
                    v-if="col.virtual"
                    ref="virtual"
                    :column="col"
                    :row="localState"
                    :nodes="nodes"
                    :meta="meta"
                    :api="api"
                    :active="false"
                    :sql-ui="sqlUi"
                    :is-form="true"
                    :dummy="true"
                  />
                  <editable-cell
                    v-else
                    :id="`data-table-form-${col._cn}`"
                    v-model="localState[col._cn]"
                    :db-alias="dbAlias"
                    :column="col"
                    class="xc-input body-2"
                    :meta="meta"
                    :sql-ui="sqlUi"
                    is-form
                    :dummy="true"
                  />
                </div>
              </div>
              <!--            </v-card>-->
            </div>
          </draggable>
          <div class="my-10 text-center">
            <v-btn color="primary">
              Submit
            </v-btn>
          </div>
        </div>
      </v-col>
    </v-row>
  </v-container>
</template>

<script>

import draggable from 'vuedraggable'
import VirtualHeaderCell from '../components/virtualHeaderCell'
import HeaderCell from '../components/headerCell'
import VirtualCell from '../components/virtualCell'
import EditableCell from '../components/editableCell'
import Editable from '../components/editable'

export default {
  name: 'FormView',
  components: { Editable, EditableCell, VirtualCell, HeaderCell, VirtualHeaderCell, draggable },
  props: ['meta', 'availableColumns', 'nodes', 'sqlUi', 'formParams', 'showFields', 'fieldsOrder', 'allColumns'],
  data: () => ({
    localState: {},
    moved: false
    // hiddenColumns: []
  }),
  computed: {
    localParams: {
      get() {
        return this.formParams || {}
      },
      set(params) {
        this.$emit('update:formParams', params)
      }
    },
    hiddenColumns: {
      get() {
        return this.allColumns.filter(c => !this.showFields[c.alias])
      }
    },
    columns: {
      get() {
        return this.allColumns.filter(c => this.showFields[c.alias])
      },
      set(val) {
        const showFields = val.reduce((o, v) => {
          o[v.alias] = true
          return o
        }, {})
        console.log(showFields, this.showFields)
        const fieldsOrder = val.map(v => v.alias)
        // debugger
        this.$emit('update:showFields', showFields)
        this.$emit('update:fieldsOrder', fieldsOrder)
      }
    }
  },
  watch: {
    // visibleColumns: {
    //   handler(val) {
    //
    //   },
    //   deep: true
    // }
  },
  mounted() {
    this.localParams = Object.assign({ name: this.meta._tn, description: 'Form view description' }, this.localParams)
    // this.columns = [...this.availableColumns]
    // this.hiddenColumns = this.meta.columns.filter(c => this.availableColumns.find(c1 => c.cn === c1.cn && c._cn === c1._cn))
  },
  methods: {
    handleMouseUp(col) {
      if (!this.moved) {
        this.columns = [...this.columns, col]
      }
    }
  }
}
</script>

<style scoped lang="scss">

.nc-field-wrapper {

  position: relative;

  .nc-field-remove-icon {
    opacity: 0;
    position: absolute;
    right: 10px;
    top: 10px;
    transition: 200ms opacity;
    z-index: 9
  }

  &:hover {
    background: var(--v-backgroundColorDefault-base);

    .nc-field-remove-icon {
      opacity: 1;
    }
  }
}

.row-col > label {
  color: grey;
  font-weight: 700;
}

.row-col:focus > label, .active-row > label {
  color: var(--v-primary-base);
}

.title.text-center {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

::v-deep {

  .v-breadcrumbs__item:nth-child(odd) {
    font-size: .72rem;
    color: grey;
  }

  .v-breadcrumbs li:nth-child(even) {
    padding: 0 6px;
    font-size: .72rem;
    color: var(--v-textColor-base);
  }

  position: relative;

  .comment-icon {
    position: absolute;
    right: 60px;
    bottom: 60px;
  }

  div > input,
  div > .xc-input > input,
  div > .xc-input > div > input,
  div > select,
  div > .xc-input > select,
  div textarea:not(.inputarea) {
    border: 1px solid #7f828b33;
    padding: 1px 5px;
    font-size: .8rem;
    border-radius: 4px;
    min-height: 44px;

    &:focus {
      border: 1px solid var(--v-primary-base);
    }

    &:hover:not(:focus) {
      box-shadow: 0 0 2px dimgrey;
    }

    background: var(--v-backgroundColorDefault-base);
  }

}

.required > div > label + * {
  border: 1px solid red;
  border-radius: 4px;
  background: var(--v-backgroundColorDefault-base);
}

.nc-meta-inputs {
  width: 400px;
  min-height: 40px;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;

  &:hover {
    background: var(--v-backgroundColor-base);
  }

  &:active, &:focus {
    border: 1px solid #7f828b33;
  }
}

.nc-drag-n-drop-to-hide {
  border: 2px dotted #a1a1a1;
  border-radius: 4px;
  font-size: .6rem;
  color: grey
}

</style>
