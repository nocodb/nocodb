<template>
  <v-dialog v-model="webhookModal" width="min(700px,90%)" overlay-opacity=".9">
    <v-card v-if="webhookModal" width="100%" min-height="350px" class="pa-4">
      <webhook-editor v-if="editOrAdd" ref="editor" :meta="meta" @backToList="editOrAdd = false" />
      <webhook-list v-else :meta="meta" @edit="editHook" @add="editOrAdd = true" />
    </v-card>
  </v-dialog>
</template>

<script>
import WebhookList from '~/components/project/tableTabs/webhook/WebhookList';
import WebhookEditor from '~/components/project/tableTabs/webhook/WebhookEditor';
export default {
  name: 'WebhookModal',
  components: { WebhookEditor, WebhookList },
  props: {
    meta: Object,
    value: Boolean,
  },
  data: () => ({
    editOrAdd: false,
    activePage: 'role',
  }),
  computed: {
    webhookModal: {
      get() {
        return this.value;
      },
      set(v) {
        this.$emit('input', v);
      },
    },
  },
  methods: {
    editHook(hook) {
      this.editOrAdd = true;
      this.$nextTick(() => {
        this.$refs.editor.hook = { ...hook };
        this.$refs.editor.onEventChange();
      });
    },
  },
};
</script>

<style scoped lang="scss"></style>
