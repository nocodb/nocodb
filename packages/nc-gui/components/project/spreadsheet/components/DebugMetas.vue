<template>
  <div>
    <v-icon small @click="metas = true"> mdi-bug-outline </v-icon>

    <v-dialog v-model="metas" max-width="800px">
      <v-card>
        <v-tabs height="30">
          <v-tab v-for="(meta, table) in metasObj" :key="table">
            <span class="caption text-capitalize">{{ table }}</span>
          </v-tab>
          <v-tab-item v-for="(meta, table) in metasObj" :key="table">
            <monaco-json-object-editor :value="meta" style="height: 80vh" />
          </v-tab-item>
        </v-tabs>
      </v-card>
    </v-dialog>
  </div>
</template>

<script>
import MonacoJsonObjectEditor from '@/components/monaco/MonacoJsonObjectEditor';
export default {
  name: 'DebugMetas',
  components: { MonacoJsonObjectEditor },
  data: () => ({ metas: false, tab: 0 }),
  computed: {
    metasObj() {
      return this.$store.state.meta.metas || {};
    },
  },
};
</script>

<style scoped></style>
