<template>
  <div class="backgroundColor pa-2"
       style="width:530px">
    <div class="grid" @click.stop>

      <template dense v-for="(filter,i) in filters">

        <v-icon :key="i + '_3'" v-if="!filter.readOnly" small class=""
                @click.stop="filters.splice(i,1)">mdi-close-box
        </v-icon>
        <span v-else :key="i + '_1'">
        </span>

        <span :key="i + '_2'"
              v-if="!i" class="caption d-flex align-center">where</span>

        <v-select :key="i + '_4'"
                  v-else
                  @click.stop
                  class="flex-shrink-1 flex-grow-0 elevation-0 caption"
                  :items="['and' ,'or']"
                  solo
                  flat
                  dense
                  hide-details
                  :disabled="filter.readOnly"
                  v-model="filter.logicOp"
        >
          <template v-slot:item="{item}">
            <span class="caption font-weight-regular">{{ item }}</span>
          </template>

        </v-select>
        <v-text-field v-if="filter.readOnly"
                      :key="i + '_5'"
                      @click.stop
                      class="caption"
                      placeholder="Field"
                      solo
                      flat
                      dense
                      disabled
                      hide-details
                      v-model="filter.field"
        >
          <template v-slot:item="{item}">
            <span class="caption font-weight-regular">{{ item }}</span>
          </template>
        </v-text-field>
        <v-select
          v-else
          :key="i + '_6'"
          @click.stop
          class="caption"
          :items="fieldList"
          placeholder="Field"
          solo
          flat
          dense
          :disabled="filter.readOnly"
          hide-details
          v-model="filter.field"
        >
          <template v-slot:item="{item}">
            <span class="caption font-weight-regular">{{ item }}</span>
          </template>
        </v-select>
        <v-select
          @click.stop
          class="flex-shrink-1 flex-grow-0 caption"
          v-model="filter.op"
          :items="opList"
          placeholder="Operation"
          solo
          flat
          style="max-width:120px"
          dense
          :disabled="filter.readOnly"
          hide-details
        >
          <template v-slot:item="{item}">
            <span class="caption font-weight-regular">{{ item }}</span>
          </template>
        </v-select>
        <span v-if="['is null', 'is not null'].includes(filter.op)"></span>
        <v-text-field v-else solo flat :key="i + '_7'" @click.stop hide-details dense class="caption"
                      v-model="filter.value"
                      :disabled="filter.readOnly"></v-text-field>

      </template>
    </div>

    <!--    <v-list-item dense class="pt-2 list-btn">
          <v-btn @click.stop="addFilter" small class="elevation-0 grey&#45;&#45;text">
            <v-icon small color="grey">mdi-plus</v-icon>
            Add Filter
          </v-btn>
        </v-list-item>-->

    <v-btn @click.stop="addFilter" small class="elevation-0 grey--text my-3">
      <v-icon small color="grey">mdi-plus</v-icon>
      Add Filter
    </v-btn>
    <slot></slot>
  </div>
</template>

<script>
export default {
  name: "columnFilter",
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
      '<=',
    ],
  }),
  methods: {
    addFilter() {
      this.filters.push({
        field: '',
        op: '',
        value: '',
        logicOp: 'and'
      });
      this.filters = this.filters.slice();
    },
  },
  created() {
    this.filters = this.value || [];
  },
  watch: {
    filters: {
      handler(v) {
        this.$emit('input', v)
      },
      deep: true
    },
    value(v) {
      this.filters = v || [];
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
