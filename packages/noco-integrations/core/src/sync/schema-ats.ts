import { UITypes, TARGET_TABLES, TARGET_TABLES_META } from 'nocodb-sdk';
import { SyncSchema, SyncRecord, SyncValue } from './types';

export const SCHEMA_ATS: SyncSchema = {
  [TARGET_TABLES.ATS_APPLICATION]: {
    title: TARGET_TABLES_META[TARGET_TABLES.ATS_APPLICATION].label,
    columns: [
      { title: 'Applied At', uidt: UITypes.DateTime },
      { title: 'Rejected At', uidt: UITypes.DateTime },
      { title: 'Source', uidt: UITypes.SingleSelect },
      { title: 'Credited To', uidt: UITypes.SingleLineText },
      { title: 'Screening Question Answers', uidt: UITypes.SingleLineText },
      { title: 'Current Stage', uidt: UITypes.SingleSelect, pv: true },
      { title: 'Reject Reason', uidt: UITypes.SingleLineText },
      { title: 'Tags', uidt: UITypes.MultiSelect },
    ],
    relations: []
  },
  [TARGET_TABLES.ATS_CANDIDATE]: {
    title: TARGET_TABLES_META[TARGET_TABLES.ATS_CANDIDATE].label,
    columns: [
      { title: 'First Name', uidt: UITypes.SingleLineText, pv: true },
      { title: 'Last Name', uidt: UITypes.SingleLineText },
      { title: 'Company', uidt: UITypes.SingleLineText },
      { title: 'Title', uidt: UITypes.SingleLineText },
      { title: 'Last Interaction At', uidt: UITypes.DateTime },
      { title: 'Is Private', uidt: UITypes.Checkbox },
      { title: 'Can Email', uidt: UITypes.Checkbox },
      { title: 'Locations', uidt: UITypes.SingleLineText },
      { title: 'Phone Numbers', uidt: UITypes.PhoneNumber },
      { title: 'Email Addresses', uidt: UITypes.Email },
      { title: 'Urls', uidt: UITypes.JSON },
      { title: 'Tags', uidt: UITypes.MultiSelect },
    ],
    relations: [
      {
        columnTitle: 'Applications',
        relatedTable: TARGET_TABLES.ATS_APPLICATION,
        relatedTableColumnTitle: 'Candidate',
      },
    ],
  },
  [TARGET_TABLES.ATS_JOB]: {
    title: TARGET_TABLES_META[TARGET_TABLES.ATS_JOB].label,
    "columns": [
      { title: 'Name', uidt: UITypes.SingleLineText, pv: true },
      { title: 'Description', uidt: UITypes.LongText },
      { title: 'Code', uidt: UITypes.SingleLineText },
      { title: 'Status', uidt: UITypes.SingleSelect },
      { title: 'Type', uidt: UITypes.SingleSelect },
      // { title: 'Job Posting Urls', uidt: UITypes.URL },
      { title: 'Confidential', uidt: UITypes.Checkbox },
      { title: 'Departments', uidt: UITypes.SingleSelect },
      { title: 'Offices', uidt: UITypes.SingleSelect },
      { title: 'Hiring Managers', uidt: UITypes.SingleLineText },
      { title: 'Recruiters', uidt: UITypes.SingleLineText },
      { title: 'Tags', uidt: UITypes.MultiSelect },
    ],
    relations: [
      {
        columnTitle: 'Applications',
        relatedTable: TARGET_TABLES.ATS_APPLICATION,
        relatedTableColumnTitle: 'Job',
      },
    ]
  },
  // [TARGET_TABLES.ATS_JOB_POSTING]: {
  //   "title": TARGET_TABLES_META.ats_job_posting.label,
  //   "columns": [
  //     { title: 'Title', uidt: UITypes.SingleLineText, pv: true },
  //     { title: 'Job Posting Urls', uidt: UITypes.URL },
  //     { title: 'Status', uidt: UITypes.SingleSelect },
  //     { title: 'Content', uidt: UITypes.LongText },
  //     { title: 'Is Internal', uidt: UITypes.Checkbox },
  //   ],
  //   relations: [
  //     {
  //       columnTitle: 'Jobs',
  //       relatedTable: TARGET_TABLES.ATS_JOB,
  //       relatedTableColumnTitle: 'Job Postings',
  //     },
  //   ],
  // },
  // [TARGET_TABLES.ATS_OFFER]: {
  //   "title": TARGET_TABLES_META.ats_offer.label,
  //   "columns": [
  //     { title: 'Creator', uidt: UITypes.SingleSelect },
  //     { title: 'Closed At', uidt: UITypes.DateTime },
  //     { title: 'Sent At', uidt: UITypes.DateTime },
  //     { title: 'Start Date', uidt: UITypes.Date },
  //     { title: 'Status', uidt: UITypes.SingleSelect },
  //   ],
  //   relations: [
  //     {
  //       columnTitle: 'Application',
  //       relatedTable: TARGET_TABLES.ATS_APPLICATION,
  //       relatedTableColumnTitle: 'Offers',
  //     },
  //   ]
  // },
};
