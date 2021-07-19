<template>
  <v-dialog v-model="localState" max-width="500">
    <v-card class="elevation-20">
      <v-card-title class="grey darken-2 subheading" style="height:30px" />
      <v-card-text class="pt-4 pl-4">
        <p class="headline">
          Create <span class="text-capitalize">{{ show_as }}</span> View
        </p>
        <v-form ref="form" v-model="valid" @submit.prevent="createView">
          <v-text-field
            ref="name"
            v-model="view_name"
            label="View Name"
            :rules="[v=>!!v || 'View name required']"
            autofocus
          />
        </v-form>
      </v-card-text>
      <v-card-actions class="pa-4">
        <v-spacer />
        <v-btn class="" small @click="$emit('input',false)">
          Cancel
        </v-btn>
        <v-btn
          small
          :loading="loading"
          class="primary "
          :disabled="!valid"
          @click="createView"
        >
          Submit
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script>

export default {
  name: 'CreateViewDialog',
  props: ['value', 'nodes', 'table', 'alias', 'show_as', 'viewsCount', 'primaryValueColumn', 'meta', 'copyView'],
  data: () => ({
    valid: false,
    view_name: '',
    loading: false,
    queryParams: {}
  }),
  computed: {
    localState: {
      get() {
        return this.value
      },
      set(v) {
        this.$emit('input', v)
      }
    }
  },
  mounted() {
    try {
      if (this.copyView && this.copyView.query_params) {
        this.queryParams = { ...JSON.parse(this.copyView.query_params) }
      }
    } catch (e) {

    }
    this.view_name = `${this.alias || this.table}${this.viewsCount}`

    this.$nextTick(() => {
      const input = this.$refs.name.$el.querySelector('input')
      input.setSelectionRange(0, this.view_name.length)
      input.focus()
    })
  },
  methods: {
    async createView() {
      let showFields = null

      if (this.show_as === 'gallery') {
        showFields = { [this.primaryValueColumn]: true }
        const attachmentCol = this.meta.columns.find(c => c.uidt === 'Attachment')
        if (attachmentCol) {
          showFields[attachmentCol.cn] = true
        }
        this.meta.columns.forEach((c) => {
          if (c.pk) {
            showFields[c.cn] = true
          }
        })
      }

      this.loading = true
      try {
        const viewMeta = await this.sqlOp({
          dbAlias: this.nodes.dbAlias
        }, 'xcVirtualTableCreate', {
          title: this.view_name,
          query_params: {
            showFields,
            ...this.queryParams
          },
          parent_model_title: this.table,
          show_as: this.show_as
        })
        this.$toast.success('View created successfully').goAway(3000)
        this.$emit('created', viewMeta)
        this.$emit('input', false)
      } catch (e) {
        this.$toast.error(e.message).goAway(3000)
      }
      this.loading = false
    }
  }
}
</script>

<style scoped>

</style>
