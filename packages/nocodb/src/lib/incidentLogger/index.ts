import incidentHandler from '@deep-consulting-solutions/incident-handling';
import { envEnum } from '../../reusables';
import type { Incident } from '@deep-consulting-solutions/incident-handling';

export const createIncidentLog = async (
  data: Incident,
  extras?: Record<string, any>,
  createCustomTicketSubject?: (defaultTitle: string) => string
) => {
  if (process.env.DCS_ENV === envEnum.PROD) {
    await incidentHandler.logIncident(data, extras, {
      createCustomTicketSubject,
    });
  }
};
