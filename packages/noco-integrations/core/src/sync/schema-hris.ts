import { UITypes, TARGET_TABLES, TARGET_TABLES_META } from 'nocodb-sdk';
import { SyncSchema, SyncRecord, SyncValue } from './types';

export const SCHEMA_HRIS: SyncSchema = {
  // [TARGET_TABLES.HRIS_BANK_INFO]: {
  //   title: TARGET_TABLES_META.hris_bank_info.label,
  //   columns: [
  //     { title: 'Remote Id', uidt: UITypes.SingleLineText },
  //     { title: 'Account Number', uidt: UITypes.SingleLineText },
  //     { title: 'Routing Number', uidt: UITypes.SingleLineText },
  //     { title: 'Bank Name', uidt: UITypes.SingleLineText },
  //     { title: 'Account Type', uidt: UITypes.SingleSelect },
  //   ],
  //   relations: [
  //     {
  //       columnTitle: 'Employee',
  //       relatedTable: TARGET_TABLES.HRIS_EMPLOYEE,
  //       relatedTableColumnTitle: 'Bank Infos',
  //     },
  //   ],
  // },
  // [TARGET_TABLES.HRIS_BENEFIT]: {
  //   title: TARGET_TABLES_META.hris_benefit.label,
  //   columns: [
  //     { title: 'Remote Id', uidt: UITypes.SingleLineText },
  //     { title: 'Provider Name', uidt: UITypes.SingleLineText },
  //     { title: 'Benefit Plan Type', uidt: UITypes.SingleLineText },
  //     { title: 'Employee Contribution', uidt: UITypes.Decimal },
  //     { title: 'Company Contribution', uidt: UITypes.Decimal },
  //     { title: 'Start Date', uidt: UITypes.Date },
  //     { title: 'End Date', uidt: UITypes.Date },
  //     { title: 'Employer Benefit', uidt: UITypes.SingleLineText },
  //   ],
  //   relations: [
  //     {
  //       columnTitle: 'Employee',
  //       relatedTable: TARGET_TABLES.HRIS_EMPLOYEE,
  //       relatedTableColumnTitle: 'Benefits',
  //     },
  //   ],
  // },
  // [TARGET_TABLES.HRIS_COMPANY]: {
  //   title: TARGET_TABLES_META.hris_company.label,
  //   columns: [
  //     { title: 'Remote Id', uidt: UITypes.SingleLineText },
  //     { title: 'Legal Name', uidt: UITypes.SingleLineText, pv: true },
  //     { title: 'Display Name', uidt: UITypes.SingleLineText, pv: true },
  //     { title: 'Eins', uidt: UITypes.SingleLineText },
  //   ],
  //   relations: [],
  // },
  // [TARGET_TABLES.HRIS_DEPENDENT]: {
  //   title: TARGET_TABLES_META.hris_dependent.label,
  //   columns: [
  //     { title: 'Remote Id', uidt: UITypes.SingleLineText },
  //     { title: 'First Name', uidt: UITypes.SingleLineText, pv: true },
  //     { title: 'Middle Name', uidt: UITypes.SingleLineText },
  //     { title: 'Last Name', uidt: UITypes.SingleLineText },
  //     { title: 'Relationship', uidt: UITypes.SingleLineText },
  //     { title: 'Date Of Birth', uidt: UITypes.Date },
  //     { title: 'Gender', uidt: UITypes.SingleLineText },
  //     { title: 'Phone Number', uidt: UITypes.PhoneNumber },
  //     { title: 'Is Student', uidt: UITypes.Checkbox },
  //     { title: 'Ssn', uidt: UITypes.SingleLineText },
  //   ],
  //   relations: [
  //     {
  //       columnTitle: 'Employee',
  //       relatedTable: TARGET_TABLES.HRIS_EMPLOYEE,
  //       relatedTableColumnTitle: 'Dependents',
  //     },
  //   ],
  // },
  [TARGET_TABLES.HRIS_EMPLOYEE]: {
    title: TARGET_TABLES_META.hris_employee.label,
    columns: [
      { title: 'Employee Number', uidt: UITypes.SingleLineText, pv: true },
      { title: 'First Name', uidt: UITypes.SingleLineText },
      { title: 'Last Name', uidt: UITypes.SingleLineText },
      { title: 'Preferred Name', uidt: UITypes.SingleLineText },
      { title: 'Display Full Name', uidt: UITypes.SingleLineText },
      { title: 'Username', uidt: UITypes.SingleLineText },
      { title: 'Work Email', uidt: UITypes.Email },
      { title: 'Personal Email', uidt: UITypes.Email },
      { title: 'Mobile Phone Number', uidt: UITypes.PhoneNumber },
      { title: 'Team', uidt: UITypes.SingleLineText },
      { title: 'Pay Group', uidt: UITypes.SingleSelect },
      { title: 'SSN', uidt: UITypes.SingleLineText },
      { title: 'Gender', uidt: UITypes.SingleSelect },
      { title: 'Manager', uidt: UITypes.SingleSelect },
      { title: 'Ethnicity', uidt: UITypes.SingleSelect },
      { title: 'Marital Status', uidt: UITypes.SingleSelect },
      { title: 'Department', uidt: UITypes.SingleSelect },
      { title: 'Date Of Birth', uidt: UITypes.Date },
      { title: 'Start Date', uidt: UITypes.Date },
      { title: 'Employment Status', uidt: UITypes.SingleSelect },
      { title: 'Termination Date', uidt: UITypes.Date },
      { title: 'Avatar', uidt: UITypes.URL },
    ],
    relations: [
      // {
      //   columnTitle: 'Manager',
      //   relatedTable: TARGET_TABLES.HRIS_EMPLOYEE,
      //   relatedTableColumnTitle: 'Managed Employees',
      // },
      // {
      //   columnTitle: 'Company',
      //   relatedTable: TARGET_TABLES.HRIS_COMPANY,
      //   relatedTableColumnTitle: 'Employees',
      // },
      // {
      //   columnTitle: 'Home Location',
      //   relatedTable: TARGET_TABLES.HRIS_LOCATION,
      //   relatedTableColumnTitle: 'Home of Employees',
      // },
      // {
      //   columnTitle: 'Work Location',
      //   relatedTable: TARGET_TABLES.HRIS_LOCATION,
      //   relatedTableColumnTitle: 'Workplace of Employees',
      // },
    ],
  },
  // [TARGET_TABLES.HRIS_EMPLOYEE_PAYROLL_RUN]: {
  //   title: TARGET_TABLES_META.hris_employee_payroll_run.label,
  //   columns: [
  //     { title: 'Gross Pay', uidt: UITypes.Currency },
  //     { title: 'Net Pay', uidt: UITypes.Currency },
  //     { title: 'Start Date', uidt: UITypes.Date },
  //     { title: 'End Date', uidt: UITypes.Date },
  //     { title: 'Check Date', uidt: UITypes.Date },
  //     { title: 'Earnings', uidt: UITypes.JSON },
  //     { title: 'Deductions', uidt: UITypes.JSON },
  //     { title: 'Taxes', uidt: UITypes.JSON },
  //   ],
  //   relations: [
  //     {
  //       columnTitle: 'Employee',
  //       relatedTable: TARGET_TABLES.HRIS_EMPLOYEE,
  //       relatedTableColumnTitle: 'Payroll Runs',
  //     },
  //     {
  //       columnTitle: 'Payroll Run',
  //       relatedTable: TARGET_TABLES.HRIS_PAYROLL_RUN,
  //       relatedTableColumnTitle: 'Employee Payroll Runs',
  //     },
  //   ],
  // },
  [TARGET_TABLES.HRIS_EMPLOYMENT]: {
    title: TARGET_TABLES_META.hris_employment.label,
    columns: [
      { title: 'Job Title', uidt: UITypes.SingleLineText, pv: true },
      { title: 'Pay Rate', uidt: UITypes.Currency },
      { title: 'Pay Period', uidt: UITypes.SingleLineText },
      { title: 'Pay Frequency', uidt: UITypes.SingleSelect },
      { title: 'Pay Currency', uidt: UITypes.SingleSelect },
      { title: 'Pay Group', uidt: UITypes.SingleSelect },
      { title: 'Flsa Status', uidt: UITypes.SingleSelect },
      { title: 'Effective Date', uidt: UITypes.Date },
      { title: 'Employment Type', uidt: UITypes.SingleSelect },
    ],
    relations: [
      {
        columnTitle: 'Employee',
        relatedTable: TARGET_TABLES.HRIS_EMPLOYEE,
        relatedTableColumnTitle: 'Employments',
      },
    ],
  },
  // [TARGET_TABLES.HRIS_GROUP]: {
  //   title: TARGET_TABLES_META.hris_group.label,
  //   columns: [
  //     { title: 'Remote Id', uidt: UITypes.SingleLineText },
  //     { title: 'Parent Group', uidt: UITypes.SingleLineText },
  //     { title: 'Name', uidt: UITypes.SingleLineText, pv: true },
  //     { title: 'Type', uidt: UITypes.SingleLineText },
  //     { title: 'Is Commonly Used As Team', uidt: UITypes.Checkbox },
  //   ],
  //   relations: [
  //     {
  //       columnTitle: 'Employees',
  //       relatedTable: TARGET_TABLES.HRIS_EMPLOYEE,
  //       relatedTableColumnTitle: 'Groups',
  //     },
  //   ],
  // },
  [TARGET_TABLES.HRIS_LOCATION]: {
    title: TARGET_TABLES_META.hris_location.label,
    columns: [
      { title: 'Name', uidt: UITypes.SingleLineText, pv: true },
      { title: 'Phone Number', uidt: UITypes.PhoneNumber },
      { title: 'Street 1', uidt: UITypes.SingleLineText },
      { title: 'Street 2', uidt: UITypes.SingleLineText },
      { title: 'City', uidt: UITypes.SingleSelect },
      { title: 'State', uidt: UITypes.SingleSelect },
      { title: 'Zip Code', uidt: UITypes.SingleLineText },
      { title: 'Country', uidt: UITypes.SingleSelect },
      { title: 'Location Type', uidt: UITypes.SingleSelect },
    ],
    relations: [
      {
        columnTitle: 'Home of Employee',
        relatedTable: TARGET_TABLES.HRIS_EMPLOYEE,
        relatedTableColumnTitle: 'Home',
      },
    ],
  },
  // [TARGET_TABLES.HRIS_PAYROLL_RUN]: {
  //   title: TARGET_TABLES_META.hris_payroll_run.label,
  //   columns: [
  //     { title: 'Remote Id', uidt: UITypes.SingleLineText },
  //     { title: 'Run State', uidt: UITypes.SingleSelect },
  //     { title: 'Run Type', uidt: UITypes.SingleSelect },
  //     { title: 'Start Date', uidt: UITypes.Date },
  //     { title: 'End Date', uidt: UITypes.Date },
  //     { title: 'Check Date', uidt: UITypes.Date },
  //   ],
  //   relations: [],
  // },
  // [TARGET_TABLES.HRIS_TIME_OFF]: {
  //   title: TARGET_TABLES_META.hris_time_off.label,
  //   columns: [
  //     { title: 'Remote Id', uidt: UITypes.SingleLineText },
  //     { title: 'Approver', uidt: UITypes.SingleLineText },
  //     { title: 'Status', uidt: UITypes.SingleSelect },
  //     { title: 'Employee Note', uidt: UITypes.LongText },
  //     { title: 'Units', uidt: UITypes.SingleSelect },
  //     { title: 'Amount', uidt: UITypes.Decimal },
  //     { title: 'Request Type', uidt: UITypes.SingleSelect },
  //     { title: 'Start Time', uidt: UITypes.DateTime },
  //     { title: 'End Time', uidt: UITypes.DateTime },
  //   ],
  //   relations: [
  //     {
  //       columnTitle: 'Employee',
  //       relatedTable: TARGET_TABLES.HRIS_EMPLOYEE,
  //       relatedTableColumnTitle: 'Time Off',
  //     },
  //   ],
  // },
  // [TARGET_TABLES.HRIS_TIME_OFF_BALANCE]: {
  //   title: TARGET_TABLES_META.hris_time_off_balance.label,
  //   columns: [
  //     { title: 'Remote Id', uidt: UITypes.SingleLineText },
  //     { title: 'Balance', uidt: UITypes.Decimal },
  //     { title: 'Used', uidt: UITypes.Decimal },
  //     { title: 'Policy Type', uidt: UITypes.SingleSelect },
  //   ],
  //   relations: [
  //     {
  //       columnTitle: 'Employee',
  //       relatedTable: TARGET_TABLES.HRIS_EMPLOYEE,
  //       relatedTableColumnTitle: 'Time Off Balances',
  //     },
  //   ],
  // },
  // [TARGET_TABLES.HRIS_TIMESHEET_ENTRY]: {
  //   title: TARGET_TABLES_META.hris_timesheet_entry.label,
  //   columns: [
  //     { title: 'Remote Id', uidt: UITypes.SingleLineText },
  //     { title: 'Hours Worked', uidt: UITypes.Decimal },
  //     { title: 'Start Time', uidt: UITypes.DateTime },
  //     { title: 'End Time', uidt: UITypes.DateTime },
  //   ],
  //   relations: [
  //     {
  //       columnTitle: 'Employee',
  //       relatedTable: TARGET_TABLES.HRIS_EMPLOYEE,
  //       relatedTableColumnTitle: 'Timesheet Entries',
  //     },
  //   ],
  // },
};
