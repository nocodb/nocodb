<template>
  <v-form v-if="hook" ref="form" v-model="valid" class="mx-4" lazy-validation>
    <div>
      <a class="pointer mx-4" @click="$emit('backToList')">
        <v-icon class="ml-n1 nc-icon-hook-navigate-left">mdi-arrow-left-bold</v-icon>
      </a>
    </div>
    <v-card-title>
      {{ meta.title }} : {{ hook.title || 'Webhook' }}
      <v-spacer />

      <div class="d-flex">
        <v-spacer />
        <v-btn
          outlined
          tooltip="Save"
          small
          class="nc-btn-webhook-test"
          :disabled="loading || !valid || !hook.event"
          @click.prevent="$refs.webhookTest.testWebhook()"
        >
          Test webhook
        </v-btn>
        <v-btn
          tooltip="Save"
          color="primary"
          small
          class="nc-btn-webhook-save"
          :disabled="loading || !valid || !hook.event"
          @click.prevent="saveHooks"
        >
          <v-icon small left> save </v-icon>
          <!-- Save -->
          {{ $t('general.save') }}
        </v-btn>
      </div>
    </v-card-title>
    <v-divider class="my-4" />
    <v-card-text>
      <v-text-field
        v-model="hook.title"
        class="caption nc-text-field-hook-title"
        outlined
        dense
        :label="$t('general.title')"
        required
        :rules="[v => !!v || `${$t('general.required')}`]"
      />
      <v-row>
        <v-col>
          <webhook-event
            class="nc-text-field-hook-event"
            :event.sync="hook.event"
            :operation.sync="hook.operation"
          /> </v-col
        ><v-col>
          <v-select
            v-model="hook.notification.type"
            outlined
            dense
            :label="$t('general.notification')"
            required
            :items="notificationList"
            :rules="[v => !!v || `${$t('general.required')}`]"
            class="caption nc-text-field-hook-notification-type"
            :prepend-inner-icon="notificationIcon[hook.notification.type]"
            @change="onNotTypeChange"
          >
            <template #item="{ item }">
              <v-list-item-icon>
                <v-icon small>
                  {{ notificationIcon[item] }}
                </v-icon>
              </v-list-item-icon>
              <v-list-item-title>
                {{ item }}
              </v-list-item-title>
            </template>
          </v-select>
        </v-col>
      </v-row>
      <template v-if="hook.notification.type === 'URL'">
        <http-webhook v-model="notification" />
      </template>

      <template v-if="hook.notification.type === 'Slack'">
        <v-combobox
          v-if="slackChannels"
          v-model="notification.channels"
          :rules="[v => !!v || `${$t('general.required')}`]"
          :items="slackChannels"
          item-text="channel"
          label="Select Slack channels"
          multiple
          outlined
          dense
          class="caption"
        />
      </template>
      <template v-if="hook.notification.type === 'Microsoft Teams'">
        <v-combobox
          v-if="teamsChannels"
          v-model="notification.channels"
          :rules="[v => !!v || `${$t('general.required')}`]"
          :items="teamsChannels"
          item-text="channel"
          label="Select Teams channels"
          multiple
          outlined
          dense
          class="caption"
        />
      </template>
      <template v-if="hook.notification.type === 'Discord'">
        <v-combobox
          v-if="discordChannels"
          v-model="notification.channels"
          :rules="[v => !!v || `${$t('general.required')}`]"
          :items="discordChannels"
          item-text="channel"
          label="Select Discord channels"
          multiple
          outlined
          dense
          class="caption"
        />
      </template>
      <template v-if="hook.notification.type === 'Mattermost'">
        <v-combobox
          v-if="mattermostChannels"
          v-model="notification.channels"
          :rules="[v => !!v || `${$t('general.required')}`]"
          :items="mattermostChannels"
          item-text="channel"
          label="Select Mattermost channels"
          multiple
          outlined
          dense
          class="caption"
        />
      </template>

      <template v-if="inputs[hook.notification.type] && notification">
        <template v-for="input in inputs[hook.notification.type]">
          <v-textarea
            v-if="input.type === 'LongText'"
            :key="input.key"
            v-model="notification[input.key]"
            class="caption"
            dense
            outlined
            :label="input.label"
            :rules="[v => !input.required || !!v || `${$t('general.required')}`]"
          />
          <v-text-field
            v-else
            :key="input.key"
            v-model="notification[input.key]"
            class="caption"
            dense
            outlined
            :label="input.label"
            :rules="[v => !input.required || !!v || `${$t('general.required')}`]"
          />
        </template>
      </template>
    </v-card-text>

    <v-card-text>
      <v-card class="nc-filter-wrapper">
        <v-card-text>
          <v-checkbox
            v-model="hook.condition"
            dense
            hide-details
            class="mt-1 nc-check-box-hook-condition"
            label="On Condition"
          />

          <column-filter
            v-if="hook.condition"
            :key="key"
            ref="filter"
            v-model="filters"
            :meta="meta"
            :field-list="fieldList"
            dense
            style="max-width: 100%"
            :hook-id="hook.id"
            web-hook
          />
        </v-card-text>
      </v-card>
    </v-card-text>
    <v-card-text>
      <span class="caption grey--text">
        <em>Available context variables are <strong>data and user</strong></em>
        <v-tooltip top>
          <template #activator="{ on }">
            <v-icon small color="grey" class="ml-2" v-on="on">mdi-information</v-icon>
          </template>
          <span class="caption">
            <strong>data</strong> : Row data <br />
            <strong>user</strong> : User information<br />
          </span>
        </v-tooltip>
        <br />
        <a href="https://docs.nocodb.com/developer-resources/webhooks/">
          <!--Document Reference-->
          {{ $t('labels.docReference') }}
        </a>
      </span>

      <webhooks-test
        ref="webhookTest"
        class="mt-3"
        :model-id="meta.id"
        hide-test-btn
        :hook="{
          ...hook,
          filters,
          notification: {
            ...hook.notification,
            payload: notification,
          },
        }"
      />
    </v-card-text>
  </v-form>
  <span v-else />
</template>

<script>
import WebhooksTest from '~/components/project/tableTabs/webhook/WebhooksTest';
import WebhookEvent from '~/components/project/tableTabs/webhook/WebhookEvent';
import HttpWebhook from '~/components/project/tableTabs/webhook/HttpWebhook';
import ColumnFilter from '~/components/project/spreadsheet/components/ColumnFilter';
export default {
  name: 'WebhookEditor',
  components: { ColumnFilter, HttpWebhook, WebhookEvent, WebhooksTest },
  props: {
    meta: Object,
  },
  data: () => ({
    loading: false,
    notification: {
      method: 'POST',
      body: '{{ json data }}',
    },
    hook: {
      title: 'Webhook',
      notification: {
        type: 'URL',
      },
    },
    valid: false,
    apps: {},
    slackChannels: null,
    teamsChannels: null,
    discordChannels: null,
    mattermostChannels: null,
    enableCondition: false,
    notificationList: [
      'URL',
      'Email',
      'Slack',
      'Microsoft Teams',
      'Discord',
      'Mattermost',
      'Twilio',
      'Whatsapp Twilio',
    ],
    filters: [],
    notificationIcon: {
      URL: 'mdi-link',
      Email: 'mdi-email',
      Slack: 'mdi-slack',
      'Microsoft Teams': 'mdi-microsoft-teams',
      Discord: 'mdi-discord',
      Mattermost: 'mdi-chat',
      'Whatsapp Twilio': 'mdi-whatsapp',
      Twilio: 'mdi-cellphone-message',
    },
    inputs: {
      Email: [
        {
          key: 'to',
          label: 'To Address',
          placeholder: 'To Address',
          type: 'SingleLineText',
          required: true,
        },
        {
          key: 'subject',
          label: 'Subject',
          placeholder: 'Subject',
          type: 'SingleLineText',
          required: true,
        },
        {
          key: 'body',
          label: 'Body',
          placeholder: 'Body',
          type: 'LongText',
          required: true,
        },
      ],
      Slack: [
        {
          key: 'body',
          label: 'Body',
          placeholder: 'Body',
          type: 'LongText',
          required: true,
        },
      ],
      'Microsoft Teams': [
        {
          key: 'body',
          label: 'Body',
          placeholder: 'Body',
          type: 'LongText',
          required: true,
        },
      ],
      Discord: [
        {
          key: 'body',
          label: 'Body',
          placeholder: 'Body',
          type: 'LongText',
          required: true,
        },
      ],
      Mattermost: [
        {
          key: 'body',
          label: 'Body',
          placeholder: 'Body',
          type: 'LongText',
          required: true,
        },
      ],
      Twilio: [
        {
          key: 'body',
          label: 'Body',
          placeholder: 'Body',
          type: 'LongText',
          required: true,
        },
        {
          key: 'to',
          label: 'Comma separated Mobile #',
          placeholder: 'Comma separated Mobile #',
          type: 'LongText',
          required: true,
        },
      ],
      'Whatsapp Twilio': [
        {
          key: 'body',
          label: 'Body',
          placeholder: 'Body',
          type: 'LongText',
          required: true,
        },
        {
          key: 'to',
          label: 'Comma separated Mobile #',
          placeholder: 'Comma separated Mobile #',
          type: 'LongText',
          required: true,
        },
      ],
    },
  }),
  created() {
    this.loadPluginList();
  },
  methods: {
    async loadPluginList() {
      try {
        // const plugins = await this.$store.dispatch('sqlMgr/ActSqlOp', [null, 'xcPluginList'])
        const plugins = (await this.$api.plugin.list()).list;
        // plugins.push(...plugins.splice(0, 3))
        this.apps = plugins.reduce((o, p) => {
          p.tags = p.tags ? p.tags.split(',') : [];
          p.parsedInput = p.input && JSON.parse(p.input);
          o[p.title] = p;
          return o;
        }, {});
      } catch (e) {}
    },
    addNewHook() {
      this.onEventChange();
      this.$refs.form.resetValidation();
    },
    async onNotTypeChange() {
      this.notification = {};
      if (this.hook.notification.type === 'Slack') {
        this.slackChannels = (this.apps && this.apps.Slack && this.apps.Slack.parsedInput) || [];
      }
      if (this.hook.notification.type === 'Microsoft Teams') {
        this.teamsChannels =
          (this.apps && this.apps['Microsoft Teams'] && this.apps['Microsoft Teams'].parsedInput) || [];
      }
      if (this.hook.notification.type === 'Discord') {
        this.discordChannels = (this.apps && this.apps.Discord && this.apps.Discord.parsedInput) || [];
      }
      if (this.hook.notification.type === 'Mattermost') {
        this.mattermostChannels = (this.apps && this.apps.Mattermost && this.apps.Mattermost.parsedInput) || [];
      }
      if (this.hook.notification.type === 'URL') {
        this.notification = this.notification || {};
        this.$set(this.notification, 'body', '{{ json data }}');
      }
      this.$nextTick(() => this.$refs.form.validate());
    },
    async onEventChange() {
      const { notification: { payload, type } = {}, ...hook } = this.hook;

      this.hook = {
        ...hook,
        notification: {
          type,
        },
      };
      // this.enableCondition = !!(this.hook && this.hook.condition && Object.keys(this.hook.condition).length)
      await this.onNotTypeChange();
      this.notification = payload;
      if (this.hook.notification.type === 'Slack') {
        this.notification.webhook_url =
          this.notification.webhook_url &&
          this.notification.webhook_url.map(v => this.slackChannels.find(s => v.webhook_url === s.webhook_url));
      }
      if (this.hook.notification.type === 'Microsoft Teams') {
        this.notification.webhook_url =
          this.notification.webhook_url &&
          this.notification.webhook_url.map(v => this.teamsChannels.find(s => v.webhook_url === s.webhook_url));
      }
      if (this.hook.notification.type === 'Discord') {
        this.notification.webhook_url =
          this.notification.webhook_url &&
          this.notification.webhook_url.map(v => this.discordChannels.find(s => v.webhook_url === s.webhook_url));
      }
      if (this.hook.notification.type === 'Mattermost') {
        this.notification.webhook_url =
          this.notification.webhook_url &&
          this.notification.webhook_url.map(v => this.mattermostChannels.find(s => v.webhook_url === s.webhook_url));
      }
      if (this.hook.notification.type === 'URL') {
        this.notification = this.notification || {};
        this.$set(this.notification, 'body', this.notification.body || '{{ json data }}');
      }
    },
    async saveHooks() {
      if (!this.$refs.form.validate() || !this.valid || !this.hook.event) {
        return;
      }
      this.loading = true;
      try {
        let res;
        if (this.hook.id) {
          res = await this.$api.dbTableWebhook.update(this.hook.id, {
            ...this.hook,
            notification: {
              ...this.hook.notification,
              payload: this.notification,
            },
          });
        } else {
          res = await this.$api.dbTableWebhook.create(this.meta.id, {
            ...this.hook,
            notification: {
              ...this.hook.notification,
              payload: this.notification,
            },
          });
        }

        if (!this.hook.id && res) {
          this.hook.id = res.id;
        }
        if (this.$refs.filter) {
          await this.$refs.filter.applyChanges(false, {
            hookId: this.hook.id,
          });
        }

        this.$toast.success('Webhook details updated successfully').goAway(3000);
      } catch (e) {
        this.$toast.error(e.message).goAway(3000);
      }
      this.loading = false;

      this.$e('a:webhook:add', {
        operation: this.hook.operation,
        condition: this.hook.condition,
        notification: this.hook.notification.type,
      });
    },
  },
};
</script>

<style scoped>
/deep/ .nc-filter-wrapper label {
  font-size: 0.75rem !important;
}
</style>
