<template>
  <v-dialog v-model="localState" max-width="500">
    <v-card class="elevation-20">
      <v-card-title class="grey darken-2 subheading" style="height:30px" />
      <v-card-text class="pt-4 pl-4">
        <p class="headline">
          {{ $t('general.create') }} <span class="text-capitalize">{{ show_as }}</span> {{ $t('objects.view') }}
        </p>
        <v-form ref="form" v-model="valid" @submit.prevent="createView">
          <!-- label="View Name" -->
          <v-text-field
            ref="name"
            v-model="view_name"
            :label="$t('labels.viewName')"
            :rules="[v=>!!v || 'View name required', v => viewsList.every((v1) => (v1.alias || v1.title) !== v) || 'View name should be unique']"
            autofocus
          />
        </v-form>
      </v-card-text>
      <v-card-actions class="pa-4">
        <v-spacer />
        <v-btn class="" small @click="$emit('input',false)">
          {{ $t('general.cancel') }}
        </v-btn>
        <v-btn
          small
          :loading="loading"
          class="primary "
          :disabled="!valid"
          @click="createView"
        >
          {{ $t('general.submit') }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script>

import { ViewTypes } from 'nocodb-sdk'

export default {
  name: 'CreateViewDialog',
  props: ['value', 'nodes', 'table', 'alias', 'show_as', 'viewsCount', 'primaryValueColumn', 'meta', 'copyView', 'viewsList', 'selectedViewId'],
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
    },
    typeAlias() {
      return ({
        [ViewTypes.GRID]: 'grid',
        [ViewTypes.GALLERY]: 'gallery',
        [ViewTypes.FORM]: 'form',
        [ViewTypes.KANBAN]: 'kanban'
      })[this.show_as]
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
      if (!this.valid) {
        return
      }

      this.loading = true
      try {
        let data
        switch (this.show_as) {
          case ViewTypes.GRID:
            data = (await this.$api.dbView.gridCreate(this.meta.id, {
              title: this.view_name,
              copy_from_id: this.selectedViewId
            }))
            break
          case ViewTypes.GALLERY:
            data = (await this.$api.dbView.galleryCreate(this.meta.id, {
              title: this.view_name,
              copy_from_id: this.selectedViewId
            }))
            break
          case ViewTypes.FORM:
            data = (await this.$api.dbView.formCreate(this.meta.id, {
              title: this.view_name,
              copy_from_id: this.selectedViewId
            }))
            break
        }
        this.$toast.success('View created successfully').goAway(3000)
        this.$emit('created', data)
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
