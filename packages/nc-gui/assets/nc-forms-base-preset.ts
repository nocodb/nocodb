import type { Preset } from 'unocss'

// WindiCSS ran @windicss/plugin-forms with its default strategy, which emits this element-level
// base — bare inputs, selects and textareas got padding, a border and a focus ring without any
// class. presetForms is configured with strategy: 'class' here, which emits none of it, so every
// unstyled input in the app silently lost that padding on the UnoCSS migration.
//
// Painted colours sit in :where(), so they carry zero specificity and any class-level rule —
// the dark-mode `.nc-input` rules, a component's own background — wins without !important.
// Geometry keeps normal specificity so it still beats the generic `input { padding: 0 }` reset.
//
// Captured from windicss@3.5.6 running the original windi.config.ts, so the bare-element
// rendering matches what the app was built against. The `--tw-ring-*` names are Windi's and are
// self-contained: the rule defines every variable it reads.
const FORMS_BASE = `
[type='text'], [type='email'], [type='url'], [type='password'], [type='number'], [type='date'], [type='datetime-local'], [type='month'], [type='search'], [type='tel'], [type='time'], [type='week'], [multiple], textarea, select { -webkit-appearance: none; -moz-appearance: none; appearance: none; border-width: 1px; border-radius: 0px; padding-top: 0.5rem; padding-right: 0.75rem; padding-bottom: 0.5rem; padding-left: 0.75rem; font-size: 1rem; line-height: 1.5rem; }
:where([type='text'], [type='email'], [type='url'], [type='password'], [type='number'], [type='date'], [type='datetime-local'], [type='month'], [type='search'], [type='tel'], [type='time'], [type='week'], [multiple], textarea, select) { background-color: #fff; border-color: #6A7184; }
[type='text']:focus, [type='email']:focus, [type='url']:focus, [type='password']:focus, [type='number']:focus, [type='date']:focus, [type='datetime-local']:focus, [type='month']:focus, [type='search']:focus, [type='tel']:focus, [type='time']:focus, [type='week']:focus, [multiple]:focus, textarea:focus, select:focus { --tw-ring-inset: var(--tw-empty,/*!*/ /*!*/); --tw-ring-offset-width: 0px; --tw-ring-offset-color: #fff; --tw-ring-color: #2B99CC; --tw-ring-offset-shadow: var(--tw-ring-inset) 0 0 0 var(--tw-ring-offset-width) var(--tw-ring-offset-color); --tw-ring-shadow: var(--tw-ring-inset) 0 0 0 calc(1px + var(--tw-ring-offset-width)) var(--tw-ring-color); box-shadow: var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow, 0 0 #0000); border-color: #2B99CC; }
[type='checkbox'], [type='radio'] { -webkit-appearance: none; -moz-appearance: none; appearance: none; padding: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; display: inline-block; vertical-align: middle; background-origin: border-box; -webkit-user-select: none; -moz-user-select: none; -ms-user-select: none; user-select: none; flex-shrink: 0; height: 1rem; width: 1rem; border-width: 1px; }
:where([type='checkbox'], [type='radio']) { color: #2B99CC; background-color: #fff; border-color: #6A7184; }
[type='checkbox']:focus, [type='radio']:focus { --tw-ring-inset: var(--tw-empty,/*!*/ /*!*/); --tw-ring-offset-width: 2px; --tw-ring-offset-color: #fff; --tw-ring-color: #2B99CC; --tw-ring-offset-shadow: var(--tw-ring-inset) 0 0 0 var(--tw-ring-offset-width) var(--tw-ring-offset-color); --tw-ring-shadow: var(--tw-ring-inset) 0 0 0 calc(2px + var(--tw-ring-offset-width)) var(--tw-ring-color); box-shadow: var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow, 0 0 #0000); border-color: #6A7184; }
[type='checkbox']:checked, [type='radio']:checked { border-color: transparent; background-color: currentColor; background-size: 100% 100%; background-position: center; background-repeat: no-repeat; }
[type='checkbox']:checked:hover, [type='checkbox']:checked:focus, [type='radio']:checked:hover, [type='radio']:checked:focus { border-color: transparent; background-color: currentColor; }
[type='checkbox']:indeterminate:hover, [type='checkbox']:indeterminate:focus { border-color: transparent; background-color: currentColor; }
::-webkit-datetime-edit-fields-wrapper { padding: 0; }
::-webkit-date-and-time-value { min-height: 1.5em; }
[multiple] { background-image: initial; background-position: initial; background-repeat: unset; background-size: initial; padding-right: 0.75rem; -webkit-print-color-adjust: unset; print-color-adjust: unset; }
[type='checkbox'] { border-radius: 0px; }
[type='radio'] { border-radius: 100%; }
[type='checkbox']:checked { background-image: url("data:image/svg+xml,%3csvg viewBox='0 0 16 16' fill='white' xmlns='http://www.w3.org/2000/svg'%3e%3cpath d='M12.207 4.793a1 1 0 010 1.414l-5 5a1 1 0 01-1.414 0l-2-2a1 1 0 011.414-1.414L6.5 9.086l4.293-4.293a1 1 0 011.414 0z'/%3e%3c/svg%3e"); }
[type='radio']:checked { background-image: url("data:image/svg+xml,%3csvg viewBox='0 0 16 16' fill='white' xmlns='http://www.w3.org/2000/svg'%3e%3ccircle cx='8' cy='8' r='3'/%3e%3c/svg%3e"); }
[type='checkbox']:indeterminate { background-image: url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 16 16'%3e%3cpath stroke='white' stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M4 8h8'/%3e%3c/svg%3e"); border-color: transparent; background-color: currentColor; background-size: 100% 100%; background-position: center; background-repeat: no-repeat; }
[type='file'] { background: unset; border-width: 0; border-radius: 0; padding: 0; font-size: unset; line-height: inherit; }
:where([type='file']) { border-color: inherit; }
[type='file']:focus { outline: 1px solid ButtonText; outline: 1px auto -webkit-focus-ring-color; }
`

export const ncFormsBasePreset = (): Preset => ({
  name: 'nc-forms-base',
  preflights: [{ getCSS: () => FORMS_BASE }],
})

export default ncFormsBasePreset
