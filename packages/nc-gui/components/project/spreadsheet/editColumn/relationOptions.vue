<template>
  <v-container fluid class="wrapper">
    <v-row>
      <v-col cols="6">
        <v-autocomplete
          :rules="[v=>!!v || 'Reference Table required']"
          outlined
          class="caption"
          hide-details
          :loading="isRefTablesLoading"
          label="Reference Table"
          :full-width="false"
          v-model="relation.parentTable"
          :items="refTables"
          item-text="_tn"
          item-value="tn"
          required
          dense
          @change="loadColumnList"
        ></v-autocomplete>
      </v-col
      >
      <v-col cols="6">
        <v-autocomplete
          :rules="[v=>!!v || 'Reference Column required']"
          outlined
          class="caption"
          hide-details
          :loading="isRefColumnsLoading"
          label="Reference Column"
          :full-width="false"
          v-model="relation.parentColumn"
          :items="refColumns"
          item-text="_cn"
          item-value="cn"
          required
          dense
          ref="parentColumnRef"
          @change="onColumnSelect"
        ></v-autocomplete>
      </v-col
      >
    </v-row>

    <v-row>
      <v-col cols="6">
        <v-autocomplete
          outlined
          class="caption"
          hide-details
          label="On Update"
          :full-width="false"
          v-model="relation.onUpdate"
          :items="onUpdateDeleteOptions"
          required
          dense
          :disabled="relation.type !== 'real'"
        ></v-autocomplete>
      </v-col>
      <v-col cols="6">
        <v-autocomplete
          outlined
          class="caption"
          hide-details
          label="On Delete"
          :full-width="false"
          v-model="relation.onDelete"
          :items="onUpdateDeleteOptions"
          required
          dense
          :disabled="relation.type !== 'real'"
        ></v-autocomplete>
      </v-col>
    </v-row>


    <v-row>

      <v-col>
        <v-checkbox
          :disabled="isSQLite"
          false-value="real"
          true-value="virtual"
          label="Virtual Relation"
          :full-width="false"
          v-model="relation.type"
          required
          class="mt-0"
          dense
        ></v-checkbox>
      </v-col>
    </v-row>

  </v-container>
</template>

<script>
export default {
  name: "relationOptions",
  props: ['nodes', 'column', 'isSQLite'],
  data: () => ({
    refTables: [],
    refColumns: [],
    relation: {},
    isRefTablesLoading: false,
    isRefColumnsLoading: false,
    onUpdateDeleteOptions: [
      "NO ACTION",
      "CASCADE",
      "RESTRICT",
      "SET NULL",
      "SET DEFAULT"
    ],
  }),
  async created() {
    await this.loadTablesList();
    this.relation = {
      childColumn: this.column.cn,
      childTable: this.nodes.tn,
      parentTable: this.column.rtn || "",
      parentColumn: this.column.rcn || "",
      onDelete: "CASCADE",
      onUpdate: "CASCADE",
      updateRelation: this.column.rtn ? true : false,
      type: this.isSQLite ? 'virtual' : 'real'
    }
  },
  methods: {
    async loadColumnList() {
      if (!this.relation.parentTable) return;
      this.isRefColumnsLoading = true;


      const result = await this.$store.dispatch('sqlMgr/ActSqlOp', [{
        env: this.nodes.env,
        dbAlias: this.nodes.dbAlias
      }, 'columnList', {tn: this.relation.parentTable}])


      const columns = result.data.list;
      this.refColumns = JSON.parse(JSON.stringify(columns));

      if (this.relation.updateRelation && !this.relationColumnChanged) {
        //only first time when editing add defaault value to this field
        this.relation.parentColumn = this.column.rcn;
        this.relationColumnChanged = true;
      } else {
        //find pk column and assign to parentColumn
        const pkKeyColumns = this.refColumns.filter(el => el.pk);
        this.relation.parentColumn = (pkKeyColumns[0] || {}).cn || "";
      }
      this.onColumnSelect();

      this.isRefColumnsLoading = false;
    },
    async loadTablesList() {
      this.isRefTablesLoading = true;


      const result = await this.$store.dispatch('sqlMgr/ActSqlOp', [{
        env: this.nodes.env,
        dbAlias: this.nodes.dbAlias
      }, 'tableList']);


      this.refTables = result.data.list.map(({tn, _tn}) => ({tn, _tn}))
      this.isRefTablesLoading = false;
    },
    async saveRelation() {
      try {
        let result = await this.$store.dispatch('sqlMgr/ActSqlOpPlus', [
          {
            env: this.nodes.env,
            dbAlias: this.nodes.dbAlias
          },
          this.relation.type === 'real' && !this.isSQLite ? "relationCreate" : 'xcVirtualRelationCreate',
          this.relation
        ]);
      } catch (e) {
        throw e;
      }
    },
    onColumnSelect() {
      const col = this.refColumns.find(c => this.relation.parentColumn === c.cn);
      this.$emit('onColumnSelect', col)
    }
  },
  watch: {
    'column.cn': function (c) {
      this.$set(this.relation, 'childColumn', c);
    },
    isSQLite(v) {
      this.$set(this.relation, 'type', v ? 'virtual' : 'real');
    }
  },
  mounted() {
    this.$set(this.relation, 'type', this.isSqlite ? 'virtual' : 'real');
  }
}
</script>

<style scoped>

.wrapper {
  border: solid 2px #7f828b33;
  border-radius: 4px;
}

/deep/ .v-input__append-inner {
  margin-top: 4px !important;
}
</style>
