import {
  type IntegrationEntry,
  IntegrationType,
} from '@noco-integrations/core';
import { ChatwootAuthIntegration } from './integration';
import { form } from './form';
import { manifest } from './manifest';

const integration: IntegrationEntry = {
  type: IntegrationType.Auth,
  sub_type: 'chatwoot',
  wrapper: ChatwootAuthIntegration,
  form,
  manifest,
};

export default integration;