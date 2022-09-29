<template>
  <!--  <v-dialog :value="true">-->
  <v-card>
    <v-textarea v-model="template" />

    <v-btn @click="ImportTemplate"> import </v-btn>
  </v-card>
  <!--  </v-dialog>-->
</template>

<script>
export default {
  name: 'ImportTemplate',
  props: {
    nodes: Object,
  },
  data() {
    return {
      template: '',
    };
  },
  methods: {
    importTemplate() {
      try {
        const template = JSON.parse(this.template);
        this.$store.dispatch('sqlMgr/ActSqlOp', [
          {
            dbAlias: this.nodes.dbAlias,
            env: '_noco',
          },
          'xcModelsCreateFromTemplate',
          {
            template,
          },
        ]);
      } catch (e) {
        this.$toast.error(e.message).goAway(3000);
      }
    },
  },
};
</script>

<style scoped></style>
