// Button behaviour shared by base Button fields and interface buttons.

export interface ButtonConfirmation {
  title?: string;
  message?: string;
  button_label?: string;
}

/** One field write applied to the clicked record. */
export interface ButtonRecordUpdate {
  fk_column_id: string;
  value: unknown;
}

/** How the button looks once its action has succeeded. */
export interface ButtonAppearanceAfter {
  color?: string;
  label?: string;
  show_check_icon?: boolean;
}

/** What bound a `core.trigger.button` workflow trigger. */
export type ButtonTriggerSource = 'interface' | 'field';
