import {
  FormBuilderInputType,
  FormBuilderValidatorType,
  NocoSDK,
  WorkflowNodeCategory,
} from '@noco-integrations/core';
import { HubspotNodeBase } from '../../../base';
import { CrmObjectType, DEFAULT_PROPERTIES } from '../../../utils/constants';
import type {
  FormDefinition,
  WorkflowNodeDefinition,
  WorkflowNodeLog,
  WorkflowNodeResult,
  WorkflowNodeRunContext,
} from '@noco-integrations/core';
import type { HubspotNodeConfig } from '../../../utils/types';

interface GetContactConfig extends HubspotNodeConfig {
  contactId: string;
  properties?: string;
}

export class GetContactNode extends HubspotNodeBase<GetContactConfig> {
  public async definition(): Promise<WorkflowNodeDefinition> {
    const form: FormDefinition = [
      this.getAuthFormField(),
      {
        type: FormBuilderInputType.WorkflowInput,
        label: 'Contact ID',
        model: 'config.contactId',
        placeholder: '123456789',
        validators: [
          {
            type: FormBuilderValidatorType.Required,
            message: 'Contact ID is required',
          },
        ],
      },
      {
        type: FormBuilderInputType.WorkflowInput,
        label: 'Properties',
        model: 'config.properties',
        placeholder: 'email,firstname,lastname',
        helpText:
          'Comma-separated list of properties to return. Leave empty for default properties.',
        group: 'moreOptions',
        groupCollapsible: true,
        groupLabel: 'More Options',
        groupDefaultCollapsed: true,
      },
    ];

    return {
      id: 'hubspot_crm.action.contact_get',
      title: 'Get Contact',
      description: 'Get a contact by ID from HubSpot CRM',
      icon: 'hubspot',
      category: WorkflowNodeCategory.ACTION,
      ports: [{ id: 'output', direction: 'output', order: 0 }],
      form,
      hidden: true,
      keywords: ['hubspot', 'crm', 'contact', 'get', 'fetch', 'retrieve'],
    };
  }

  public async generateInputVariables(): Promise<NocoSDK.VariableDefinition[]> {
    return [
      {
        key: 'config.contactId',
        type: NocoSDK.VariableType.String,
        name: 'Contact ID',
        extra: {
          icon: 'ncHash',
          description: 'The ID of the contact to retrieve',
        },
      },
      ...(this.config.properties
        ? [
            {
              key: 'config.properties',
              type: NocoSDK.VariableType.String,
              name: 'Properties',
              extra: {
                icon: 'ncList',
                description: 'Comma-separated list of properties to return',
              },
            },
          ]
        : []),
    ];
  }

  public async generateOutputVariables(): Promise<
    NocoSDK.VariableDefinition[]
  > {
    return [
      {
        key: 'success',
        type: NocoSDK.VariableType.Boolean,
        name: 'Success',
        extra: {
          icon: 'cellCheckbox',
          description: 'Whether the contact was retrieved successfully',
        },
      },
      {
        key: 'contactId',
        type: NocoSDK.VariableType.String,
        name: 'Contact ID',
        extra: {
          icon: 'ncHash',
          description: 'The ID of the retrieved contact',
        },
      },
      {
        key: 'contact',
        type: NocoSDK.VariableType.Object,
        name: 'Contact',
        extra: {
          icon: 'ncUser',
          description: 'The contact object from HubSpot',
        },
        children: [
          {
            key: 'contact.id',
            type: NocoSDK.VariableType.String,
            name: 'ID',
            extra: { icon: 'ncHash' },
          },
          {
            key: 'contact.properties',
            type: NocoSDK.VariableType.Object,
            name: 'Properties',
            children: [
              {
                key: 'contact.properties.email',
                type: NocoSDK.VariableType.String,
                name: 'Email',
                extra: { icon: 'ncMail' },
              },
              {
                key: 'contact.properties.firstname',
                type: NocoSDK.VariableType.String,
                name: 'First Name',
                extra: { icon: 'ncUser' },
              },
              {
                key: 'contact.properties.lastname',
                type: NocoSDK.VariableType.String,
                name: 'Last Name',
                extra: { icon: 'ncUser' },
              },
              {
                key: 'contact.properties.phone',
                type: NocoSDK.VariableType.String,
                name: 'Phone',
                extra: { icon: 'ncPhone' },
              },
              {
                key: 'contact.properties.company',
                type: NocoSDK.VariableType.String,
                name: 'Company',
                extra: { icon: 'ncBuilding' },
              },
              {
                key: 'contact.properties.jobtitle',
                type: NocoSDK.VariableType.String,
                name: 'Job Title',
                extra: { icon: 'ncBriefcase' },
              },
              {
                key: 'contact.properties.lifecyclestage',
                type: NocoSDK.VariableType.String,
                name: 'Lifecycle Stage',
                extra: { icon: 'ncFlag' },
              },
            ],
            extra: {
              icon: 'cellJson',
            },
          },
          {
            key: 'contact.createdAt',
            type: NocoSDK.VariableType.String,
            name: 'Created At',
            extra: { icon: 'cellDatetime' },
          },
          {
            key: 'contact.updatedAt',
            type: NocoSDK.VariableType.String,
            name: 'Updated At',
            extra: { icon: 'cellDatetime' },
          },
          {
            key: 'contact.archived',
            type: NocoSDK.VariableType.Boolean,
            name: 'Archived',
            extra: { icon: 'cellCheckbox' },
          },
          {
            key: 'contact.url',
            type: NocoSDK.VariableType.String,
            name: 'URL',
            extra: { icon: 'cellUrl' },
          },
        ],
      },
    ];
  }

  public async run(
    ctx: WorkflowNodeRunContext<GetContactConfig>,
  ): Promise<WorkflowNodeResult> {
    const startTime = Date.now();
    const logs: WorkflowNodeLog[] = [];
    const config = ctx.inputs?.config || {};

    try {
      if (!config.authIntegrationId) {
        return this.createValidationError(
          'HubSpot Account is required',
          'MISSING_AUTH',
          logs,
          startTime,
        );
      }

      if (!config.contactId) {
        return this.createValidationError(
          'Contact ID is required',
          'MISSING_ID',
          logs,
          startTime,
        );
      }

      const properties = config.properties
        ? config.properties.split(',').map((p) => p.trim())
        : DEFAULT_PROPERTIES[CrmObjectType.CONTACTS];

      this.logInfo(logs, `Getting contact: ${config.contactId}`);

      const contact = await this.useHubspot(async (client) => {
        const res = await client.get(
          `/crm/v3/objects/${CrmObjectType.CONTACTS}/${config.contactId}`,
          { params: { properties: properties.join(',') } },
        );
        return res.data;
      });

      this.logInfo(logs, `Contact retrieved successfully: ${contact.id}`);

      return this.createSuccessResult(
        { contact, contactId: contact.id },
        logs,
        startTime,
      );
    } catch (error) {
      return this.handleError(error, logs, startTime);
    }
  }
}
