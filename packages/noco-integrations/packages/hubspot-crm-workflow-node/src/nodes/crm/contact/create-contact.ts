import {
  FormBuilderInputType,
  FormBuilderValidatorType,
  NocoSDK,
  WorkflowNodeCategory,
} from '@noco-integrations/core';
import { HubspotNodeBase } from '../../../base';
import { CrmObjectType } from '../../../utils/constants';
import type {
  FormDefinition,
  WorkflowNodeDefinition,
  WorkflowNodeLog,
  WorkflowNodeResult,
  WorkflowNodeRunContext,
} from '@noco-integrations/core';
import type { HubspotNodeConfig } from '../../../utils/types';

interface CreateContactConfig extends HubspotNodeConfig {
  email: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  company?: string;
  jobTitle?: string;
  lifecycleStage?: string;
  additionalProperties?: Record<string, unknown>;
}

export class CreateContactNode extends HubspotNodeBase<CreateContactConfig> {
  public async definition(): Promise<WorkflowNodeDefinition> {
    const form: FormDefinition = [
      this.getAuthFormField(),
      {
        type: FormBuilderInputType.WorkflowInput,
        label: 'Email',
        model: 'config.email',
        placeholder: 'contact@example.com',
        validators: [
          {
            type: FormBuilderValidatorType.Required,
            message: 'Email is required',
          },
        ],
      },
      {
        type: FormBuilderInputType.WorkflowInput,
        label: 'First Name',
        model: 'config.firstName',
        placeholder: 'John',
      },
      {
        type: FormBuilderInputType.WorkflowInput,
        label: 'Last Name',
        model: 'config.lastName',
        placeholder: 'Doe',
      },
      {
        type: FormBuilderInputType.WorkflowInput,
        label: 'Phone',
        model: 'config.phone',
        placeholder: '+1234567890',
      },
      {
        type: FormBuilderInputType.WorkflowInput,
        label: 'Company',
        model: 'config.company',
        placeholder: 'Acme Inc.',
      },
      {
        type: FormBuilderInputType.WorkflowInput,
        label: 'Job Title',
        model: 'config.jobTitle',
        placeholder: 'Software Engineer',
      },
      {
        type: FormBuilderInputType.Select,
        label: 'Lifecycle Stage',
        model: 'config.lifecycleStage',
        options: [
          { label: 'Subscriber', value: 'subscriber' },
          { label: 'Lead', value: 'lead' },
          {
            label: 'Marketing Qualified Lead',
            value: 'marketingqualifiedlead',
          },
          { label: 'Sales Qualified Lead', value: 'salesqualifiedlead' },
          { label: 'Opportunity', value: 'opportunity' },
          { label: 'Customer', value: 'customer' },
          { label: 'Evangelist', value: 'evangelist' },
          { label: 'Other', value: 'other' },
        ],
        placeholder: 'Select lifecycle stage',
      },
      {
        type: FormBuilderInputType.KeyValue,
        label: 'Additional Properties',
        model: 'config.additionalProperties',
        keyLabel: 'Property',
        valueLabel: 'Value',
        placeholder: 'Add property',
        helpText: 'Add any additional HubSpot contact properties',
        group: 'moreOptions',
        groupCollapsible: true,
        groupLabel: 'More Options',
        groupDefaultCollapsed: true,
      },
    ];

    return {
      id: 'hubspot_crm.action.contact_create',
      title: 'Create Contact',
      description: 'Create a new contact in HubSpot CRM',
      icon: 'hubspot',
      category: WorkflowNodeCategory.ACTION,
      ports: [{ id: 'output', direction: 'output', order: 0 }],
      form,
      hidden: true,
      keywords: ['hubspot', 'crm', 'contact', 'create', 'add'],
    };
  }

  public async generateInputVariables(): Promise<NocoSDK.VariableDefinition[]> {
    const inputs: NocoSDK.VariableDefinition[] = [
      {
        key: 'config.email',
        type: NocoSDK.VariableType.String,
        name: 'Email',
        extra: {
          icon: 'ncMail',
          description: 'Email address for the contact',
        },
      },
    ];

    if (this.config.firstName) {
      inputs.push({
        key: 'config.firstName',
        type: NocoSDK.VariableType.String,
        name: 'First Name',
        extra: { icon: 'ncUser', description: 'First name of the contact' },
      });
    }
    if (this.config.lastName) {
      inputs.push({
        key: 'config.lastName',
        type: NocoSDK.VariableType.String,
        name: 'Last Name',
        extra: { icon: 'ncUser', description: 'Last name of the contact' },
      });
    }
    if (this.config.phone) {
      inputs.push({
        key: 'config.phone',
        type: NocoSDK.VariableType.String,
        name: 'Phone',
        extra: { icon: 'ncPhone', description: 'Phone number of the contact' },
      });
    }
    if (this.config.company) {
      inputs.push({
        key: 'config.company',
        type: NocoSDK.VariableType.String,
        name: 'Company',
        extra: { icon: 'ncBuilding', description: 'Company of the contact' },
      });
    }
    if (this.config.jobTitle) {
      inputs.push({
        key: 'config.jobTitle',
        type: NocoSDK.VariableType.String,
        name: 'Job Title',
        extra: { icon: 'ncBriefcase', description: 'Job title of the contact' },
      });
    }

    return inputs;
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
          description: 'Whether the contact was created successfully',
        },
      },
      {
        key: 'contactId',
        type: NocoSDK.VariableType.String,
        name: 'Contact ID',
        extra: {
          icon: 'ncHash',
          description: 'The ID of the created contact',
        },
      },
      {
        key: 'contact',
        type: NocoSDK.VariableType.Object,
        name: 'Contact',
        extra: {
          icon: 'ncUser',
          description: 'The created contact object from HubSpot',
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
    ctx: WorkflowNodeRunContext<CreateContactConfig>,
  ): Promise<WorkflowNodeResult> {
    const startTime = Date.now();
    const logs: WorkflowNodeLog[] = [];
    const config = ctx.inputs?.config || {};

    try {
      const {
        email,
        firstName,
        lastName,
        phone,
        company,
        jobTitle,
        lifecycleStage,
        additionalProperties = {},
      } = config;

      if (!config.authIntegrationId) {
        return this.createValidationError(
          'HubSpot Account is required',
          'MISSING_AUTH',
          logs,
          startTime,
        );
      }

      if (!email) {
        return this.createValidationError(
          'Email is required',
          'MISSING_EMAIL',
          logs,
          startTime,
        );
      }

      const properties: Record<string, unknown> = {
        email,
        ...additionalProperties,
      };
      if (firstName) properties.firstname = firstName;
      if (lastName) properties.lastname = lastName;
      if (phone) properties.phone = phone;
      if (company) properties.company = company;
      if (jobTitle) properties.jobtitle = jobTitle;
      if (lifecycleStage) properties.lifecyclestage = lifecycleStage;

      this.logInfo(logs, `Creating contact with email: ${email}`);

      const contact = await this.useHubspot(async (client) => {
        const res = await client.post(
          `/crm/v3/objects/${CrmObjectType.CONTACTS}`,
          { properties },
        );
        return res.data;
      });

      this.logInfo(logs, `Contact created successfully with ID: ${contact.id}`);

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
