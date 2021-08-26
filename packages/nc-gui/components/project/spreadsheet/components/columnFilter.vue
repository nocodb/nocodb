<template>
  <div
    class="backgroundColor pa-2"
    style="width:530px"
  >
    <div class="grid" @click.stop>
      <template v-for="(filter,i) in filters" dense>
        <v-icon
          v-if="!filter.readOnly"
          :key="i + '_3'"
          small
          class=""
          @click.stop="filters.splice(i,1)"
        >
          mdi-close-box
        </v-icon>
        <span v-else :key="i + '_1'" />

        <span
          v-if="!i"
          :key="i + '_2'"
          class="caption d-flex align-center"
        >where</span>

        <v-select
          v-else
          :key="i + '_4'"
          v-model="filter.logicOp"
          class="flex-shrink-1 flex-grow-0 elevation-0 caption "
          :items="['and' ,'or']"
          solo
          flat
          dense
          hide-details
          :disabled="filter.readOnly"
          @click.stop
        >
          <template #item="{item}">
            <span class="caption font-weight-regular">{{ item }}</span>
          </template>
        </v-select>
        <v-text-field
          v-if="filter.readOnly"
          :key="i + '_5'"
          v-model="filter.field"
          class="caption "
          placeholder="Field"
          solo
          flat
          dense
          disabled
          hide-details
          @click.stop
        >
          <template #item="{item}">
            <span class="caption font-weight-regular">{{ item }}</span>
          </template>
        </v-text-field>
        <v-select
          v-else
          :key="i + '_6'"
          v-model="filter.field"
          class="caption nc-filter-field-select"
          :items="fieldList"
          placeholder="Field"
          solo
          flat
          dense
          :disabled="filter.readOnly"
          hide-details
          @click.stop
        >
          <template #item="{item}">
            <span class="caption font-weight-regular">{{ item }}</span>
          </template>
        </v-select>
        <v-select
          :key="'k' + i"
          v-model="filter.op"
          class="flex-shrink-1 flex-grow-0 caption  nc-filter-operation-select"
          :items="opList"
          placeholder="Operation"
          solo
          flat
          style="max-width:120px"
          dense
          :disabled="filter.readOnly"
          hide-details
          @click.stop
        >
          <template #item="{item}">
            <span class="caption font-weight-regular">{{ item }}</span>
          </template>
        </v-select>
        <span v-if="['is null', 'is not null'].includes(filter.op)" :key="'span' + i" />
        <v-text-field
          v-else
          :key="i + '_7'"
          v-model="filter.value"
          solo
          flat
          hide-details
          dense
          class="caption nc-filter-value-select"
          :disabled="filter.readOnly"
          @click.stop
        />
      </template>
    </div>

    <!--    <v-list-item dense class="pt-2 list-btn">
          <v-btn @click.stop="addFilter" small class="elevation-0 grey&#45;&#45;text">
            <v-icon small color="grey">mdi-plus</v-icon>
            Add Filter
          </v-btn>
        </v-list-item>-->

    <v-btn small class="elevation-0 grey--text my-3" @click.stop="addFilter">
      <v-icon small color="grey">
        mdi-plus
      </v-icon>
      Add Filter
    </v-btn>
    <slot />
  </div>
</template>

<script>
export default {
  name: 'ColumnFilter',
  props: ['fieldList', 'value'],
  data: () => ({
    filters: [],
    opList: [
      'is equal', 'is not equal', 'is like', 'is not like',
      // 'is empty', 'is not empty',
      'is null', 'is not null',
      '>',
      '<',
      '>=',
      '<='
    ]
  }),
  watch: {
    filters: {
      handler(v) {
        this.$emit('input', v)
      },
      deep: true
    },
    value(v) {
      this.filters = v || []
    }
  },
  created() {
    this.filters = this.value || []
  },
  methods: {
    addFilter() {
      this.filters.push({
        field: '',
        op: '',
        value: '',
        logicOp: 'and'
      })
      this.filters = this.filters.slice()
    }
  }
}
</script>

<style scoped>
.grid {
  display: grid;
  grid-template-columns:22px 80px auto 110px auto;
  column-gap: 6px;
  row-gap: 6px
}
</style>
