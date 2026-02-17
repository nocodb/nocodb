import { BaseType } from '../Api';

export enum FormBuilderInputType {
  Input = 'input',
  Textarea = 'textarea',
  Select = 'select',
  Switch = 'switch',
  Space = 'space',
  Password = 'password',
  Number = 'number',
  SelectIntegration = 'integration',
  SelectBase = 'select-base',
  SelectTable = 'select-table',
  SelectView = 'select-view',
  SelectField = 'select-field',
  OAuth = 'oauth',
  Checkbox = 'checkbox',
  WorkflowInput = 'workflow-input',
  KeyValue = 'key-value',
  EntitySelector = 'entity-selector',
  ConditionBuilder = 'condition-builder',
}

/**
 * Condition configuration for conditional field visibility
 * Only one condition type should be specified per condition object
 */
export interface FormBuilderCondition {
  /** Model path to check for condition (e.g., 'config.type') */
  model: string;
  /** Check if the model value equals this specific value */
  value?: string;
  /** Alias for value - check if the model value equals this value */
  equal?: string;
  /** Check if the model value is in this array of values */
  in?: string[];
  /** Check if the model value is NOT in this array of values */
  notIn?: string[];
  /** Check if the model value is empty (empty string, empty array, null, undefined) */
  empty?: boolean;
  /** Check if the model value is not empty */
  notEmpty?: boolean;
  /** Check if the model value does NOT equal this value */
  notEqual?: string;
}

/**
 * Hide condition configuration - field will be hidden when condition is met
 * Opposite of show condition (condition property)
 */
export type FormBuilderHideCondition = FormBuilderCondition;

/**
 * Logical operator for combining multiple conditions
 */
export type FormBuilderConditionOperator = 'and' | 'or';

/**
 * Multiple conditions with logical operator
 */
export interface FormBuilderConditionGroup {
  /** Logical operator to combine conditions (default: 'and') */
  operator?: FormBuilderConditionOperator;
  /** Array of conditions to evaluate */
  conditions: FormBuilderCondition[];
}

/**
 * Enum defining all available validator types
 */
export enum FormBuilderValidatorType {
  Required = 'required',
  Regex = 'regex',
  MinValue = 'minValue',
  MaxValue = 'maxValue',
  MinLength = 'minLength',
  MaxLength = 'maxLength',
  Email = 'email',
  Url = 'url',
  Custom = 'custom',
}

/**
 * Base validator configuration
 */
interface FormBuilderValidatorBase {
  type: FormBuilderValidatorType;
  /** Custom error message to display when validation fails */
  message?: string;
}

/**
 * Required validator
 */
export interface FormBuilderRequiredValidator extends FormBuilderValidatorBase {
  type: FormBuilderValidatorType.Required;
}

/**
 * Regex validator - validates against a regular expression pattern
 */
export interface FormBuilderRegexValidator extends FormBuilderValidatorBase {
  type: FormBuilderValidatorType.Regex;
  /** Regular expression pattern to match */
  pattern: string;
  /** Regex flags (e.g., 'i' for case-insensitive) */
  flags?: string;
}

/**
 * MinValue validator - validates minimum numeric value
 */
export interface FormBuilderMinValueValidator extends FormBuilderValidatorBase {
  type: FormBuilderValidatorType.MinValue;
  /** Minimum allowed value */
  value: number;
}

/**
 * MaxValue validator - validates maximum numeric value
 */
export interface FormBuilderMaxValueValidator extends FormBuilderValidatorBase {
  type: FormBuilderValidatorType.MaxValue;
  /** Maximum allowed value */
  value: number;
}

/**
 * MinLength validator - validates minimum string length
 */
export interface FormBuilderMinLengthValidator
  extends FormBuilderValidatorBase {
  type: FormBuilderValidatorType.MinLength;
  /** Minimum string length */
  value: number;
}

/**
 * MaxLength validator - validates maximum string length
 */
export interface FormBuilderMaxLengthValidator
  extends FormBuilderValidatorBase {
  type: FormBuilderValidatorType.MaxLength;
  /** Maximum string length */
  value: number;
}

/**
 * Email validator - validates email format
 */
export interface FormBuilderEmailValidator extends FormBuilderValidatorBase {
  type: FormBuilderValidatorType.Email;
}

/**
 * URL validator - validates URL format
 */
export interface FormBuilderUrlValidator extends FormBuilderValidatorBase {
  type: FormBuilderValidatorType.Url;
}

export interface CustomFormBuilderValidator extends FormBuilderValidatorBase {
  type: FormBuilderValidatorType.Custom;
  validator: (rule: any, value: any) => Promise<any>;
}

/**
 * Union type of all validator configurations
 */
export type FormBuilderValidator =
  | FormBuilderRequiredValidator
  | FormBuilderRegexValidator
  | FormBuilderMinValueValidator
  | FormBuilderMaxValueValidator
  | FormBuilderMinLengthValidator
  | FormBuilderMaxLengthValidator
  | FormBuilderEmailValidator
  | FormBuilderUrlValidator
  | CustomFormBuilderValidator;

/**
 * Option configuration for select elements
 */
export interface FormBuilderSelectOption {
  /** Display label for the option */
  label: string;
  /** Value to be stored when option is selected */
  value: string;
  /** Whether the option is disabled **/
  ncItemDisabled?: boolean;
  /** Reason for the disabled state **/
  ncItemTooltip?: string;
  /**
   * Icon for the option (IconMapKey)
   */
  icon?: string;
}

/**
 * Integration filter configuration for SelectIntegration elements
 */
export interface FormBuilderIntegrationFilter {
  /** Integration type to filter by (e.g., 'Auth', 'Communication') */
  type?: string;
  /** Integration sub-type to filter by (e.g., 'gmail,outlook,smtp') */
  sub_type?: string;
}

/**
 * OAuth metadata configuration for OAuth elements
 */
export interface FormBuilderOAuthMeta {
  /** OAuth provider name (e.g., 'GitHub', 'Google') */
  provider: string;
  /** OAuth authorization URI - supports template variables like {{config.subdomain}} */
  authUri: string;
  /** OAuth redirect URI for callback */
  redirectUri: string;
  /** OAuth client ID */
  clientId: string;
  /** OAuth scopes to request */
  scopes?: string[];
  /** Key name for authorization code in callback (default: 'code') */
  codeKey?: string;
}

/**
 * Base interface for all form builder elements
 */
interface FormBuilderElementBase {
  /** Property path in the form JSON (e.g., 'config.apiKey', 'title') */
  model?: string;
  /** Display label for the element */
  label?: string;
  /** Placeholder text (for input elements) */
  placeholder?: string;
  /** Width as percentage (0-100) */
  width?: number;
  /**
   * Number of grid columns this field should span.
   *
   * Uses a 24-column layout system:
   * - span: 24 → full width
   * - span: 12 → half width
   * - span: 8  → one-third width
   * - span: 6  → one-quarter width
   *
   * If not specified, defaults to full width (24).
   *
   * This allows consistent responsive layout instead of relying on `width` percentages.
   */
  span?: number;
  // description for the element
  description?: string;
  /** Category for grouping elements - same category elements are grouped together */
  category?: string;
  /**
   * Condition(s) for the element to be visible (show condition)
   * Can be a single condition, array of conditions (AND logic), or a condition group
   */
  condition?:
    | FormBuilderCondition
    | FormBuilderCondition[]
    | FormBuilderConditionGroup;
  /**
   * Hide condition(s) - element will be hidden when condition is met
   * Opposite of show condition. Can be a single condition, array (AND), or group
   */
  hideCondition?:
    | FormBuilderHideCondition
    | FormBuilderHideCondition[]
    | FormBuilderConditionGroup;
  /** Show border around the element */
  border?: boolean;
  /** Show hint as tooltip instead of inline text */
  showHintAsTooltip?: boolean;
  /**
   * Just to show required asterisk in label
   * @note: Use required field validator along with this to ensure field is required
   * */
  required?: boolean;
  /** Validators for field validation */
  validators?: FormBuilderValidator[];
  /** Model path(s) this field depends on - when dependency changes, options are reloaded */
  dependsOn?: string | string[];
  /** Help text for the element */
  helpText?: string;
  /**
   * Link to the documentation for the element
   */
  docsLink?: string;
  /**
   * Group name for this field. Fields with the same group name will be grouped together.
   * Groups can be placed anywhere in the form and can contain any fields.
   */
  group?: string;
  /**
   * Whether this group should be collapsible (only applies to first field in a group)
   * When true, the group will have a toggle button to show/hide all fields in the group
   */
  groupCollapsible?: boolean;
  /**
   * Label for the collapsible group (only applies to first field in a group)
   * If not provided, defaults to "Show more" / "Show less"
   */
  groupLabel?: string;
  /**
   * Whether the group should be collapsed by default (only applies to first field in a group)
   * Default: true for collapsible groups
   */
  groupDefaultCollapsed?: boolean;
}

/**
 * Input element (text input)
 */
export interface FormBuilderInputElement extends FormBuilderElementBase {
  type: FormBuilderInputType.Input;
  defaultValue?: string | null;
}

/**
 * Textarea element (textarea input)
 */
export interface FormBuilderTextareaElement extends FormBuilderElementBase {
  type: FormBuilderInputType.Textarea;
  defaultValue?: string | null;
}

/**
 * Password element (password input)
 */
export interface FormBuilderPasswordElement extends FormBuilderElementBase {
  type: FormBuilderInputType.Password;
  defaultValue?: string | null;
}

/**
 * Number element (number input)
 */
export interface FormBuilderNumberInputElement extends FormBuilderElementBase {
  type: FormBuilderInputType.Number;
  defaultValue?: number | null;
}

/**
 * Select element (dropdown)
 */
export interface FormBuilderSelectElement extends FormBuilderElementBase {
  type: FormBuilderInputType.Select;
  /** Options for the select dropdown */
  options?: FormBuilderSelectOption[];
  /** Select mode - single, multiple, or multiple with custom input */
  selectMode?: 'single' | 'multiple' | 'multipleWithInput' | 'singleWithInput';
  /** Key to fetch options dynamically */
  fetchOptionsKey?: string;
  /** Enable server-side search - when true, typing triggers fetchOptions with search query */
  searchable?: boolean;
  /** Default value - string for single, array for multiple */
  defaultValue?: string | string[] | null;
}

/**
 * Switch element (toggle)
 */
export interface FormBuilderSwitchElement extends FormBuilderElementBase {
  type: FormBuilderInputType.Switch;
  defaultValue?: boolean;
}

/**
 * Checkbox element (checkbox input)
 */
export interface FormBuilderCheckboxElement extends FormBuilderElementBase {
  type: FormBuilderInputType.Checkbox;
  defaultValue?: boolean;
}

/**
 * Space element (visual separator)
 */
export interface FormBuilderSpaceElement
  extends Omit<FormBuilderElementBase, 'model' | 'validators'> {
  type: FormBuilderInputType.Space;
}

/**
 * SelectIntegration element (integration picker)
 */
export interface FormBuilderSelectIntegrationElement
  extends FormBuilderElementBase {
  type: FormBuilderInputType.SelectIntegration;
  /** Filter integrations by type and sub-type */
  integrationFilter?: FormBuilderIntegrationFilter;
  defaultValue?: string | null;
}

/**
 * SelectBase element (base/project picker)
 */
export interface FormBuilderSelectBaseElement extends FormBuilderElementBase {
  type: FormBuilderInputType.SelectBase;
  defaultValue?: string | null;
  filterOption?: (base: BaseType) => boolean;
}

/**
 * SelectTable element (table picker)
 */
export interface FormBuilderSelectTableElement extends FormBuilderElementBase {
  type: FormBuilderInputType.SelectTable;
  /** Options for the table dropdown */
  options?: FormBuilderSelectOption[];
  /** Key to fetch table options dynamically */
  fetchOptionsKey?: string;
  /** Select mode - single, multiple */
  selectMode?: 'single' | 'multiple';
  /** Default value - string for single, array for multiple */
  defaultValue?: string | string[] | null;
}

/**
 * SelectView element (view picker)
 */
export interface FormBuilderSelectViewElement extends FormBuilderElementBase {
  type: FormBuilderInputType.SelectView;
  /** Options for the view dropdown */
  options?: FormBuilderSelectOption[];
  /** Key to fetch view options dynamically */
  fetchOptionsKey?: string;
  /** Select mode - single, multiple */
  selectMode?: 'single' | 'multiple';
  /** Default value - string for single, array for multiple */
  defaultValue?: string | string[] | null;
}

/**
 * SelectField element (field/column picker)
 */
export interface FormBuilderSelectFieldElement extends FormBuilderElementBase {
  type: FormBuilderInputType.SelectField;
  /** Options for the field dropdown */
  options?: FormBuilderSelectOption[];
  /** Key to fetch field options dynamically */
  fetchOptionsKey?: string;
  /** Select mode - single, multiple */
  selectMode?: 'single' | 'multiple';
  /** Default value - string for single, array for multiple */
  defaultValue?: string | string[] | null;
}

/**
 * OAuth element (OAuth authentication)
 */
export interface FormBuilderOAuthElement extends FormBuilderElementBase {
  type: FormBuilderInputType.OAuth;
  /** OAuth configuration metadata */
  oauthMeta?: FormBuilderOAuthMeta;
  defaultValue?: string | null;
}

/**
 * WorkflowInput element (TipTap editor with expression support for workflow variables)
 */
export interface FormBuilderWorkflowInputElement
  extends FormBuilderElementBase {
  type: FormBuilderInputType.WorkflowInput;
  plugins?: Array<'multiline'>;
  defaultValue?: string | null;
}

/**
 * KeyValue element (Dynamic key-value pair input for arbitrary data)
 */
export interface FormBuilderKeyValueElement extends FormBuilderElementBase {
  type: FormBuilderInputType.KeyValue;
  /** Label for the key column */
  keyLabel?: string;
  /** Label for the value column */
  valueLabel?: string;
  /** Default key-value pairs as Record<key, value> */
  defaultValue?: Record<string, string> | null;
}

/**
 * EntitySelector mode configuration
 */
export interface EntitySelectorMode {
  /** Mode type: 'list' for dropdown, 'manual' for WorkflowInput */
  type: 'list' | 'manual';
  /** Key to fetch options dynamically (for 'list' mode) */
  fetchOptionsKey?: string;
  /** Enable server-side search (for 'list' mode) */
  searchable?: boolean;
  /** Placeholder text for this mode */
  placeholder?: string;
}

/**
 * EntitySelector element - Select dropdown with optional toggle to WorkflowInput
 *
 * Use cases:
 * - Select an entity from a dropdown (e.g., HubSpot Contact)
 * - OR enter an ID/expression manually using WorkflowInput
 *
 * Value is stored as simple string (the ID/value).
 */
export interface FormBuilderEntitySelectorElement
  extends FormBuilderElementBase {
  type: FormBuilderInputType.EntitySelector;
  /** Available modes - defaults to just list mode if not specified */
  modes?: EntitySelectorMode[];
  /** Default value - simple string */
  defaultValue?: string | null;
}

/**
 * Filter operator types by data type
 */
export type FilterOperatorType =
  // String operators
  | 'equals'
  | 'notEquals'
  | 'contains'
  | 'notContains'
  | 'startsWith'
  | 'endsWith'
  | 'regex'
  // Number operators
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte'
  // DateTime operators
  | 'after'
  | 'before'
  // Boolean operators
  | 'isTrue'
  | 'isFalse'
  // Common operators
  | 'exists'
  | 'notExists'
  | 'empty'
  | 'notEmpty';

/**
 * Filter data types
 */
export type FilterDataType =
  | 'string'
  | 'number'
  | 'boolean'
  | 'dateTime'
  | 'array'
  | 'object'
  | 'any';

/**
 * Filter operator definition
 */
export interface FilterOperator {
  /** Operator identifier */
  id: string;
  /** Display name */
  name: string;
  /** Data type this operator applies to */
  type: FilterDataType;
  /** Operation type */
  operation: FilterOperatorType;
  /** Whether this operator doesn't need a right-side value (e.g., exists, empty) */
  singleValue?: boolean;
  /** Expected type for right-side value (if different from left) */
  rightType?: FilterDataType;
}

/**
 * Single filter condition value
 */
export interface FilterConditionValue {
  /** Unique ID for this condition */
  id?: string;
  /** Left side value (field/variable reference or literal) */
  leftValue: string;
  /** Selected operator */
  operator: {
    type: FilterDataType;
    operation: FilterOperatorType;
  };
  /** Right side value (comparison value) */
  rightValue?: string;
}

/**
 * Filter combinator type
 */
export type FilterCombinator = 'and' | 'or';

/**
 * Condition builder value (array of conditions with combinator)
 */
export interface ConditionBuilderValue {
  /** Combinator for combining conditions (default: 'and') */
  combinator: FilterCombinator;
  /** Array of filter conditions */
  conditions: FilterConditionValue[];
}

/**
 * ConditionBuilder element - Complex filter/condition builder with drag-drop conditions
 */
export interface FormBuilderConditionBuilderElement
  extends FormBuilderElementBase {
  type: FormBuilderInputType.ConditionBuilder;
  /** Allowed data types for filtering */
  allowedTypes?: FilterDataType[];
  /** Whether the left value is fixed (not editable) */
  fixedLeftValue?: boolean;
  /** Supported operators (if not specified, all operators are available) */
  supportedOperators?: FilterOperatorType[];
  /** Whether conditions can be reordered */
  sortable?: boolean;
  /** Maximum number of conditions */
  maxConditions?: number;
  /** Default value */
  defaultValue?: ConditionBuilderValue | null;
  /** Static property options for the left value dropdown */
  propertyOptions?: FormBuilderSelectOption[];
  /** Key to fetch property options dynamically */
  fetchPropertyOptionsKey?: string;
  /** Placeholder for property field */
  propertyPlaceholder?: string;
}

/**
 * Union type of all possible form builder elements
 */
export type FormBuilderElement =
  | FormBuilderInputElement
  | FormBuilderTextareaElement
  | FormBuilderPasswordElement
  | FormBuilderSelectElement
  | FormBuilderSwitchElement
  | FormBuilderCheckboxElement
  | FormBuilderSpaceElement
  | FormBuilderSelectIntegrationElement
  | FormBuilderSelectBaseElement
  | FormBuilderSelectTableElement
  | FormBuilderSelectViewElement
  | FormBuilderSelectFieldElement
  | FormBuilderOAuthElement
  | FormBuilderWorkflowInputElement
  | FormBuilderNumberInputElement
  | FormBuilderKeyValueElement
  | FormBuilderEntitySelectorElement
  | FormBuilderConditionBuilderElement;

/**
 * Complete form definition - array of form elements
 */
export type FormDefinition = FormBuilderElement[];

/**
 * Default category name for elements without a specified category
 */
export const FORM_BUILDER_NON_CATEGORIZED = 'form-builder-non-categorized';
