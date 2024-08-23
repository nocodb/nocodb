export interface XcPluginDoc {
  title: string;
  url: string;
}
interface XcForm {
  title: string;
  items: XcItem[];
  actions: XcButton[];
  msgOnInstall: string;
  msgOnUninstall: string;
  docs?: XcPluginDoc[];
  [key: string]: any;
}
declare enum XcType {
  ID = 'ID',
  ForeignKey = 'ForeignKey',
  SingleLineText = 'SingleLineText',
  LongText = 'LongText',
  Attachment = 'Attachment',
  Checkbox = 'Checkbox',
  MultiSelect = 'MultiSelect',
  SingleSelect = 'SingleSelect',
  Collaborator = 'Collaborator',
  Date = 'Date',
  Year = 'Year',
  Time = 'Time',
  PhoneNumber = 'PhoneNumber',
  Email = 'Email',
  URL = 'URL',
  Number = 'Number',
  Decimal = 'Decimal',
  Currency = 'Currency',
  Percent = 'Percent',
  Duration = 'Duration',
  Rating = 'Rating',
  Formula = 'Formula',
  Rollup = 'Rollup',
  Count = 'Count',
  Lookup = 'Lookup',
  DateTime = 'DateTime',
  CreateTime = 'CreateTime',
  LastModifiedTime = 'LastModifiedTime',
  AutoNumber = 'AutoNumber',
  Barcode = 'Barcode',
  Button = 'Button',
  Password = 'Password',
}
interface XcItem {
  label: string;
  key: string;
  type: XcType;
  placeholder?: string;
  default?: string;
  required?: boolean;
  help_text?: string;
  value?: string;
  values?: Array<{
    label: string;
    value: string;
  }>;
  tooltip?: string;
  validations?: any;
}
interface XcButton extends XcItem {
  type: XcType.Button;
  actionType: XcActionType;
}
declare enum XcActionType {
  SUBMIT = 'SUBMIT',
  TEST = 'TEST',
  CLEAR = 'CLEAR',
  CANCEL = 'CANCEL',
}
export { XcForm, XcItem, XcType, XcButton, XcActionType };
