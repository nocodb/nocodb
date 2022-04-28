<template>
  <div>
    <v-card-title>
      Webhook
      <v-spacer />
      <v-btn
        outlined
        tooltip="Save"
        small
      >
        Create webhook
      </v-btn>
    </v-card-title>

    <div v-if="hooks" class="pa-4">
      <v-card v-for="hook in hooks" v-ripple class="elevation-0 backgroundColor">
        <div class="pa-4 ">
          <h4 class="nc-text">
            {{ hook.title }}
          </h4>
          <div class="d-flex">
            <!--Title-->
            <span class="caption textColor1--text">{{ $t("general.event") }} : {{ hook.event }} {{ hook.operation }}</span>
            <v-spacer />
            <!--Notify Via-->
            <span class="caption textColor1--text">{{ $t("labels.notifyVia") }} : {{ hook.notification && hook.notification.type }}
            </span>
          </div>
        </div>
      </v-card>
    </div>

    <!--    <v-simple-table dense>
      <template #default>
        <thead>
          <tr>
            <th>
              &lt;!&ndash;Title&ndash;&gt;
              {{ $t("general.title") }}
            </th>
            <th>
              &lt;!&ndash;Event&ndash;&gt;
              {{ $t("general.event") }}
            </th>
            <th>
              &lt;!&ndash;Condition&ndash;&gt;
              {{ $t("general.condition") }}
            </th>
            <th>
              &lt;!&ndash;Notify Via&ndash;&gt;
              {{ $t("labels.notifyVia") }}
            </th>
            <th>
              &lt;!&ndash;Action&ndash;&gt;
              {{ $t("labels.action") }}
            </th>
          </tr>
        </thead>

        <tbody>
          <template v-if="hooks && hooks.length">
            <tr v-for="(item, i) in hooks" :key="i">
              <td>{{ item.title }}</td>
              <td>{{ item.event }} {{ item.operation }}</td>
              <td>
                <v-icon v-if="item.condition" color="success" small>
                  mdi-check-bold
                </v-icon>
              </td>
              <td>
                {{ item.notification && item.notification.type }}
              </td>
              <td>
                <x-icon
                  small
                  color="error"
                  @click.stop="deleteHook(item, i)"
                >
                  mdi-delete
                </x-icon>
              &lt;!&ndash;              <x-icon small :color="loading || !valid || !hook.event ?  'grey' : 'primary'"
                                  @click.stop="(!loading && valid && hook.event) && saveHooks()">save
                          </x-icon>&ndash;&gt;
              </td>
            </tr>
          </template>
          <tr>
            <td colspan="6" class="text-center py-5">
              &lt;!&ndash;:tooltip="$t('tooltip.saveChanges')"&ndash;&gt;
              <x-btn
                v-ge="['hooks', 'add new']"
                outlined
                color="primary"
                small
                @click.prevent="$emit('add')"
              >
                <v-icon small left>
                  mdi-plus
                </v-icon>
                &lt;!&ndash;Add New Webhook&ndash;&gt;
                {{ $t("activity.addWebhook") }}
              </x-btn>
            </td>
          </tr>
        </tbody>
      </template>
    </v-simple-table>-->
  </div>
</template>

<script>
export default {
  name: 'WebhookList',
  props: { meta: Object },
  data: () => ({
    hooks: null, loading: false
  }),
  mounted() {
    this.loadHooksList()
  },
  methods: {
    async loadHooksList() {
      this.key++
      this.loading = true

      const hooks = await this.$api.dbTableWebhook.list(this.meta.id)

      this.hooks = hooks.list.map((h) => {
        h.notification = h.notification && JSON.parse(h.notification)
        return h
      })
      this.loading = false
    }
  }
}
</script>

<style scoped>

</style>
