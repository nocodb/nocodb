export enum FormBuilderInputType {
  Input = 'input',
  Select = 'select',
  Switch = 'switch',
  Space = 'space',
  Password = 'password',
  SelectIntegration = 'integration',
  SelectBase = 'select-base',
  SelectTable = 'select-table',
  SelectView = 'select-view',
  SelectField = 'select-field',
  OAuth = 'oauth',
  Checkbox = 'checkbox',
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
  /** Check if the model value is empty (empty string, empty array, null, undefined) */
  empty?: boolean;
  /** Check if the model value is not empty */
  notEmpty?: boolean;
}

/**
 * Enum defining all available validator types
 */
export enum FormBuilderValidatorType {
  Required = 'required',
}

/**
 * Validator configuration for form field validation
 */
export interface FormBuilderValidator {
  /** Type of validation to apply */
  type: FormBuilderValidatorType;
  /** Custom error message to display when validation fails */
  message?: string;
}

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
  /** Condition(s) for the element to be visible */
  condition?: FormBuilderCondition | FormBuilderCondition[];
  /** Show border around the element */
  border?: boolean;
  /** Show hint as tooltip instead of inline text */
  showHintAsTooltip?: boolean;
  /** Validators for field validation */
  validators?: FormBuilderValidator[];
  /** Model path(s) this field depends on - when dependency changes, options are reloaded */
  dependsOn?: string | string[];
  /** Help text for the element */
  helpText?: string;
}

/**
 * Input element (text input)
 */
export interface FormBuilderInputElement extends FormBuilderElementBase {
  type: FormBuilderInputType.Input;
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
 * Select element (dropdown)
 */
export interface FormBuilderSelectElement extends FormBuilderElementBase {
  type: FormBuilderInputType.Select;
  /** Options for the select dropdown */
  options?: FormBuilderSelectOption[];
  /** Select mode - single, multiple, or multiple with custom input */
  selectMode?: 'single' | 'multiple' | 'multipleWithInput';
  /** Key to fetch options dynamically */
  fetchOptionsKey?: string;
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
 * Union type of all possible form builder elements
 */
export type FormBuilderElement =
  | FormBuilderInputElement
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
  | FormBuilderOAuthElement;

/**
 * Complete form definition - array of form elements
 */
export type FormDefinition = FormBuilderElement[];

/**
 * Default category name for elements without a specified category
 */
export const FORM_BUILDER_NON_CATEGORIZED = 'form-builder-non-categorized';
