import IncidentHandler from '@deep-consulting-solutions/incident-handling';
import { DataRecoveryActivity, ServerIncident } from '../database/entities';
import RedisCacheMgr from '../lib/cache/RedisCacheMgr';
import { getRedisURI } from '../database/redis';
import type { IncidentHandlerOptions } from '@deep-consulting-solutions/incident-handling';
import type { Application } from 'express';
import type { Connection } from 'typeorm';

export enum envEnum {
  DEV = 'dev',
  PROD = 'production',
  STAGING = 'staging',
  TESTING = 'test',
}

export const getIncidentHandlerConfig = ({
  app,
  connection,
}: {
  app: Application;
  connection: Connection;
}): IncidentHandlerOptions => {
  const redis = new RedisCacheMgr(getRedisURI());

  let ticketBlueprintTransitions = [];
  try {
    ticketBlueprintTransitions = JSON.parse(
      process.env.INCIDENT_HANDLING_DESK_TICKET_RESOLUTION_BLUEPRINTS
    );
  } catch (e) {}

  return {
    app,
    projectName: 'NocoDB',
    connection,
    entities: {
      ServerIncident,
      DataRecoveryActivity,
    },
    redis: redis.client,
    zoho: {
      desk: {
        config: {
          accountsUrl:
            process.env.ZOHO_ACCOUNTS_BASE_URL || 'https://accounts.zoho.com',
          clientId: process.env.ZOHO_DESK_MONITORING_CLIENT_ID,
          clientSecret: process.env.ZOHO_DESK_MONITORING_CLIENT_SECRET,
          refreshToken: process.env.ZOHO_DESK_MONITORING_REFRESH_TOKEN,
          apiUrl: process.env.ZOHO_DESK_MONITORING_DEPARTMENT_URL,
          orgId: process.env.ZOHO_DESK_MONITORING_ORG_ID,
          monitoringDepartmentId:
            process.env.DCS_ENV === envEnum.PROD
              ? process.env.DCS_ZOHO_DESK_ABNORMAL_USAGE_DEPARTMENT_ID
              : process.env.DCS_ZOHO_DESK_IT_ALERTS_TEST_DEPARTMENT_ID,
          monitoringDepartmentEmail:
            process.env.ZOHO_DESK_MONITORING_DEPARTMENT_EMAIL,
        },
        ticketBlueprintTransitions,
      },
      crm: {
        config: {
          accountsUrl:
            process.env.ZOHO_ACCOUNTS_BASE_URL || 'https://accounts.zoho.com',
          clientId: process.env.ZOHO_CLIENT_ID,
          clientSecret: process.env.ZOHO_CLIENT_SECRET,
          refreshToken: process.env.ZOHO_REFRESH_TOKEN,
          dataRecoveryConfig: [],
          apiUrl: `${
            process.env.ZOHO_CRM_BASE_URL || 'https://www.zohoapis.com/crm'
          }/v2`,
        },
      },
    },
  };
};

export const setupReusablesAndRoutes = async (
  app: any,
  connection: Connection
) => {
  await IncidentHandler.setup(getIncidentHandlerConfig({ app, connection }));
};
