import { PlanTitles } from '~/lib';

export const PlanMeta = {
  [PlanTitles.FREE]: {
    title: PlanTitles.FREE,
    color: '#F9F9FA',
    accent: '#E7E7E9',
    primary: '#1F293A',
    bgLight: '#F9F9FA',
    bgDark: '#F4F4F5',
    border: '#E7E7E9',
  },
  [PlanTitles.TEAM]: {
    title: PlanTitles.TEAM,
    color: '#EDF9FF',
    accent: '#AFE5FF',
    primary: '#207399',
    bgLight: '#EDF9FF',
    bgDark: '#D7F2FF',
    border: '#AFE5FF',
  },
  [PlanTitles.BUSINESS]: {
    title: PlanTitles.BUSINESS,
    color: '#FFF5EF',
    accent: '#FDCDAD',
    primary: '#C86827',
    bgLight: '#FFF5EF',
    bgDark: '#FDCDAD',
    border: '#FDCDAD',
  },
  [PlanTitles.ENTERPRISE]: {
    title: PlanTitles.ENTERPRISE,
    color: '#0D1117',
    accent: '#663B1F',
    primary: '#C86827',
    bgLight: '#FFF5EF',
    bgDark: '#FDCDAD',
    border: '#FDCDAD',
  },
} as const;
