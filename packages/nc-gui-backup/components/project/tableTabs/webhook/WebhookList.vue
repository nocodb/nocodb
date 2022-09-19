<template>
  <div>
    <v-card-title>
      <span class="text-capitalize mr-1">{{ meta.title }}</span> : Webhooks
      <v-spacer />
      <v-btn tooltip="Save" class="primary nc-btn-create-webhook" @click.prevent="$emit('add')"> Create Webhook </v-btn>
    </v-card-title>

    <v-divider />

    <div v-if="hooks" class="pa-6">
      <template v-if="hooks.length">
        <v-card
          v-for="(hook, i) in hooks"
          :key="hook.id"
          max-width="500px"
          class="mx-auto elevation-0 backgroundColor nc-hook mb-4"
          @click="$emit('edit', hook)"
        >
          <div class="d-flex">
            <v-icon class="ml-4"> mdi-hook </v-icon>
            <div class="pa-4 flex-grow-1">
              <div class="d-flex">
                <h4 class="nc-text mb-2">
                  {{ hook.title }}
                </h4>

                <v-spacer />
                <!--Notify Via-->
                <span class="caption textColor1--text mt-1"
                  >{{ $t('labels.notifyVia') }} : {{ hook.notification && hook.notification.type }}
                </span>
              </div>
              <div class="d-flex">
                <!--Title-->
                <span class="caption textColor1--text text-uppercase"> {{ hook.event }} {{ hook.operation }}</span>
              </div>
            </div>
            <v-icon class="nc-hook-delete-icon" small @click.stop="deleteHook(hook, i)"> mdi-delete-outline </v-icon>
          </div>
        </v-card>
      </template>
      <div v-else class="pa-4 backgroundColor caption textColor--text text--lighten-3">
        Webhooks list is empty, create new webhook by clicking 'Create webhook' button.
      </div>
    </div>
  </div>
</template>

<script>
import { calculateDiff } from '~/helpers';

export default {
  name: 'WebhookList',
  props: { meta: Object },
  data: () => ({
    hooks: null,
    loading: false,
  }),
  mounted() {
    this.loadHooksList();
  },
  methods: {
    calculateDiff,
    async loadHooksList() {
      this.key++;
      this.loading = true;

      const hooks = await this.$api.dbTableWebhook.list(this.meta.id);

      this.hooks = hooks.list.map(h => {
        h.notification = h.notification && JSON.parse(h.notification);
        return h;
      });
      this.loading = false;
    },
    async deleteHook(item, i) {
      try {
        if (item.id) {
          await this.$api.dbTableWebhook.delete(item.id);
          this.hooks.splice(i, 1);
        } else {
          this.hooks.splice(i, 1);
        }
        this.$toast.success('Hook deleted successfully').goAway(3000);
        if (!this.hooks.length) {
          this.hook = null;
        }
      } catch (e) {
        this.$toast.error(e.message).goAway(3000);
      }

      this.$e('a:webhook:delete');
    },
  },
};
</script>

<style scoped lang="scss">
.nc-hook {
  position: relative;

  .nc-hook-delete-icon {
    position: absolute;
    opacity: 0;
    transition: 0.3s opacity;
    right: 16px;
    bottom: 16px;
  }

  &:hover .nc-hook-delete-icon {
    opacity: 1;
  }
}
</style>
