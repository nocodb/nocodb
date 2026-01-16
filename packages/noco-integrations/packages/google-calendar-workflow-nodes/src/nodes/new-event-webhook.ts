import {
  FormBuilderInputType,
  FormBuilderValidatorType,
  type FormDefinition,
  IntegrationType,
  TriggerActivationType,
  WorkflowNodeCategory,
  WorkflowNodeIntegration,
} from '@noco-integrations/core';
import { APP_LABEL, NODE_SUBTYPE_NEW_EVENT } from '../constant';
import type {
  WorkflowActivationContext,
  WorkflowActivationState,
  WorkflowNodeConfig,
  WorkflowNodeDefinition,
  WorkflowNodeLog,
  WorkflowNodeResult,
  WorkflowNodeRunContext,
} from '@noco-integrations/core';
import type { GoogleCalendarAuthIntegration } from '@noco-integrations/google-calendar-auth';
import type { calendar_v3 } from 'googleapis';
interface NewEventWebhookNodeConfig extends WorkflowNodeConfig {
  authIntegrationId: string;
  calendar: string;
}

export class NewEventWebhookNode extends WorkflowNodeIntegration<NewEventWebhookNodeConfig> {
  public async definition(): Promise<WorkflowNodeDefinition> {
    const form: FormDefinition = [
      {
        type: FormBuilderInputType.SelectIntegration,
        label: 'Google Calendar Account',
        model: 'config.authIntegrationId',
        integrationFilter: {
          type: IntegrationType.Auth,
          sub_type: 'google_calendar',
        },
        validators: [
          {
            type: FormBuilderValidatorType.Required,
            message: 'Google Calendar is required',
          },
        ],
      },

      {
        type: FormBuilderInputType.Select,
        label: 'Calendar',
        model: 'config.calendar',
        placeholder: 'primary',
        helpText: 'Select calendar',
        dependsOn: 'config.authIntegrationId',
        validators: [
          {
            type: FormBuilderValidatorType.Required,
            message: 'Calendar is required',
          },
        ],
        fetchOptionsKey: 'calendars',
      },
    ];

    return {
      id: NODE_SUBTYPE_NEW_EVENT,
      title: `New Event Webhook`,
      description: 'Trigger an event via Google Calendar webhook on new event',
      icon: 'googleCalendar',
      category: WorkflowNodeCategory.TRIGGER,
      activationType: TriggerActivationType.WEBHOOK,
      ports: [{ id: 'output', direction: 'output', order: 0 }],
      hidden: false,
      form,
      documentation:
        'https://nocodb.com/docs/workflows/nodes/integration-nodes/google-calendar',
      keywords: ['google calendar', 'event', 'trigger', 'calendar'],
    };
  }

  /**
   * Called when workflow is published
   */
  public async onActivateHook(
    context: WorkflowActivationContext,
  ): Promise<WorkflowActivationState> {
    const auth = await this.getIntegration<GoogleCalendarAuthIntegration>(
      this.config.authIntegrationId,
    );

    return await auth.use(async (calendar) => {
      const response = await calendar.events.watch({
        calendarId: this.config.calendar,
        requestBody: {
          id: context.nodeId,
          type: 'web_hook',
          address: context.webhookUrl,
        },
      });

      return {
        webhookId: response.data.id,
        webhookResourceId: response.data.resourceId,
        webhookUrl: response.data.address,
        webhookExpiry: response.data.expiration,
        cronExpression: '0 0 * * 0,2,4', // At 00:00 on Sunday and Wednesday.
        createdAt: new Date().toISOString(),
      };
    });
  }

  /**
   * Called when workflow is unpublished
   */
  public async onDeactivateHook(
    context: WorkflowActivationContext,
    state?: WorkflowActivationState,
  ): Promise<void> {
    if (!state?.webhookId || !state?.webhookResourceId) return;

    const auth = await this.getIntegration<GoogleCalendarAuthIntegration>(
      this.config.authIntegrationId,
    );

    await auth.use(async (calendar) => {
      await calendar.channels.stop({
        requestBody: {
          id: state.webhookId,
          resourceId: state.webhookResourceId,
        },
      });
    });
  }

  public async heartbeat(
    context: WorkflowActivationContext,
    state?: WorkflowActivationState,
  ): Promise<WorkflowActivationState> {
    if (state?.webhookExpiry) {
      await this.onDeactivateHook(context, state);
      return await this.onActivateHook(context);
    } else {
      return state!;
    }
  }

  public async fetchOptions(key: string): Promise<unknown> {
    const authIntegrationId = this.config.authIntegrationId;

    if (!authIntegrationId) {
      return [];
    }

    const auth =
      await this.getIntegration<GoogleCalendarAuthIntegration>(
        authIntegrationId,
      );

    switch (key) {
      case 'calendars': {
        const result = await auth.use(async (client) => {
          const response = await client.calendarList.list();

          return (
            response.data.items
              ?.filter((cal) => {
                return (
                  !cal.deleted &&
                  ['owner', 'writer', 'reader'].includes(cal.accessRole || '')
                );
              })
              ?.map((calendar: calendar_v3.Schema$CalendarListEntry) => ({
                label: calendar.summary,
                value: calendar.id,
              })) || []
          );
        });

        return result;
      }
      default: {
        return [];
      }
    }
  }

  public async run(
    ctx: WorkflowNodeRunContext<NewEventWebhookNodeConfig>,
  ): Promise<WorkflowNodeResult> {
    const logs: WorkflowNodeLog[] = [];
    const startTime = Date.now();

    try {
      // In test mode, return sample payload
      if (ctx.testMode) {
        const auth = await this.getIntegration<GoogleCalendarAuthIntegration>(
          this.config.authIntegrationId,
        );
        // get one latest event from google calendar
        const sampleEvent = await auth.use(async (client) => {
          const response = await client.events.list({
            calendarId: this.config.calendar,
            maxResults: 1,
            singleEvents: true,
            orderBy: 'updated',
          });
          return response.data.items?.[0];
        });

        if (!sampleEvent) {
          throw new Error(
            'Create at least one event in the calendar to test the trigger',
          );
        }

        logs.push({
          level: 'info',
          message: 'Using sample Google Calendar webhook payload for testing',
          ts: Date.now(),
        });

        return {
          outputs: {
            event: 'exists',
            payload: sampleEvent,
          },
          status: 'success',
          logs,
          metrics: {
            executionTimeMs: Date.now() - startTime,
          },
        };
      }

      const inputs = (ctx.inputs as any)?.webhook as GoogleCalendarWebhookEvent;

      const webhookPayload = inputs.event || {};
      const headers = inputs.headers || {};

      const googleCalendarEvent = headers['x-goog-resource-state'];

      logs.push({
        level: 'info',
        message: `Google Calendar webhook triggered: ${googleCalendarEvent || 'event'}`,
        ts: Date.now(),
        data: {
          event: googleCalendarEvent,
          calendar: webhookPayload,
        },
      });

      return {
        outputs: {
          event: googleCalendarEvent || 'unknown',
          payload: webhookPayload,
        },
        status: 'success',
        logs,
        metrics: {
          executionTimeMs: Date.now() - startTime,
        },
      };
    } catch (error: any) {
      logs.push({
        level: 'error',
        message: `${APP_LABEL} trigger failed: ${error.message}`,
        ts: Date.now(),
        data: error.stack,
      });

      return {
        outputs: {},
        status: 'error',
        error: {
          message: error.message || `${APP_LABEL} trigger failed`,
          code: error.code,
        },
        logs,
        metrics: {
          executionTimeMs: Date.now() - startTime,
        },
      };
    }
  }
}

interface GoogleCalendarWebhookEvent {
  headers: {
    // Headers sent by Google
    'x-goog-resource-state': 'exists' | 'sync' | 'updated' | 'deleted';
    'x-goog-resource-id': string; // Unique ID of the watched resource
    'x-goog-resource-uri': string; // The URL to fetch the resource (calendar or event)
    'x-goog-channel-id': string; // Your registered channel ID
    'x-goog-message-number': string; // Incremental message number
    'x-goog-changed'?: string; // Optional, e.g., "event"
  };
  // Optional body, usually empty
  event?: calendar_v3.Schema$Event;
}
