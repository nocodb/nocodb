import { FormBuilderInputType } from 'nocodb-sdk';
export default [
  {
    type: FormBuilderInputType.Input,
    label: 'Integration name',
    width: 100,
    model: 'title',
    placeholder: 'Integration name',
    category: 'General',
    validators: [
      {
        type: 'required',
        message: 'Integration name is required',
      },
    ],
  },
  {
    type: FormBuilderInputType.Input,
    label: 'API Token',
    width: 100,
    model: 'config.token',
    category: 'Authentication',
    placeholder: 'Enter your API Token',
    validators: [
      {
        type: 'required',
        message: 'API Token is required',
      },
    ],
  },
  {
    type: FormBuilderInputType.Input,
    label: 'Base URL (optional)',
    width: 100,
    model: 'config.custom.baseURL',
    category: 'Authentication',
    placeholder: 'Enter your Base URL',
  },
];
