import { IntegrationsType } from 'nocodb-sdk';

export enum IntegrationSlots {
  SLOT0 = 'slot_0',
  SLOT1 = 'slot_1',
  SLOT2 = 'slot_2',
  SLOT3 = 'slot_3',
  SLOT4 = 'slot_4',
  NUMERIC_SLOT0 = 'slot_5',
  NUMERIC_SLOT1 = 'slot_6',
  NUMERIC_SLOT2 = 'slot_7',
  NUMERIC_SLOT3 = 'slot_8',
  NUMERIC_SLOT4 = 'slot_9',
}

export enum IntegrationSlotTypes {
  NUMBER = 'number',
  STRING = 'string',
  BOOLEAN = 'boolean',
  OBJECT = 'object',
  ARRAY = 'array',
}

export enum AiIntegrationSlots {
  input_tokens = 'input_tokens',
  output_tokens = 'output_tokens',
  total_tokens = 'total_tokens',
  model = 'model',
}

export const STORE_DEFINITIONS: Readonly<
  Record<
    string,
    Record<
      string,
      {
        id: string;
        type: string;
        required: boolean;
        description: string;
      }
    >
  >
> = {
  [IntegrationsType.Ai]: {
    [AiIntegrationSlots.input_tokens]: {
      id: IntegrationSlots.NUMERIC_SLOT0,
      type: IntegrationSlotTypes.NUMBER,
      required: false,
      description: 'Input tokens spent on operation',
    },
    [AiIntegrationSlots.output_tokens]: {
      id: IntegrationSlots.NUMERIC_SLOT1,
      type: IntegrationSlotTypes.NUMBER,
      required: false,
      description: 'Output tokens spent on operation',
    },
    [AiIntegrationSlots.total_tokens]: {
      id: IntegrationSlots.NUMERIC_SLOT2,
      type: IntegrationSlotTypes.NUMBER,
      required: false,
      description: 'Total tokens spent on operation',
    },
    [AiIntegrationSlots.model]: {
      id: IntegrationSlots.SLOT0,
      type: IntegrationSlotTypes.STRING,
      required: false,
      description: 'AI model used for operation',
    },
  },
};
