<template>
  <nc-slider v-model="webhookSlider">
    <div style="min-height:calc(100vh - 32px)" class="d-flex flex-column">
      <v-card
        v-if="webhookSlider"
        width="100%"
        min-height="350px"
        class="pa-4 elevation-0"
      >
        <webhook-editor v-if="editOrAdd" ref="editor" :meta="meta" @backToList="editOrAdd = false" />
        <webhook-list v-else :meta="meta" @edit="editHook" @add="editOrAdd = true" />
      </v-card>
      <v-spacer />
    </div>
  </nc-slider>
</template>

<script>

import WebhookList from '~/components/project/tableTabs/webhook/WebhookList'
import WebhookEditor from '~/components/project/tableTabs/webhook/WebhookEditor'
import NcSlider from '~/components/global/NcSlider'
export default {
  name: 'WebhookSlider',
  components: { NcSlider, WebhookEditor, WebhookList },
  props: {
    meta: Object,
    value: Boolean
  },
  data: () => ({
    editOrAdd: false,
    activePage: 'role'
  }),
  computed: {
    webhookSlider: {
      get() {
        return this.value
      },
      set(v) {
        this.$emit('input', v)
      }
    }
  },
  mounted() {
    (document.querySelector('[data-app]') || this.$root.$el).append(this.$el)
  },

  destroyed() {
    this.$el.parentNode && this.$el.parentNode.removeChild(this.$el)
  },
  methods: {
    editHook(hook) {
      this.editOrAdd = true
      this.$nextTick(() => {
        this.$refs.editor.hook = { ...hook }
        this.$refs.editor.onEventChange()
      })
    }
  }
}
</script>

<style scoped lang="scss">
::v-deep{
  .nc-content{max-width: 700px !important}
}
</style>
