import {
  DataObjectStream,
  SCHEMA_HRIS,
  SyncIntegration,
  TARGET_TABLES,
} from '@noco-integrations/core';
import { AxiosError } from 'axios';
import { BambooHRFormatter } from './formatter';
import type { JobInfoRecord } from './types/job-info.record';
import type { CompensationRecord } from './types/compensation.record';
import type { BambooHRAuthIntegration } from '@noco-integrations/bamboohr-auth';
import type { SyncLinkValue, SyncRecord } from '@noco-integrations/core';

export interface BambooHRSyncPayload {
  title: string;
}

interface EmployeeChanged {
  latest: string;
  employees: Record<
    string,
    { id: string; action: string; lastChanged: string }
  >;
}

interface CompensationTableChanged {
  table: string;
  employees: Record<string, CompensationRecord>;
}

interface JobInfoTableChanged {
  table: string;
  employees: Record<string, JobInfoRecord>;
}

const employeeFetchFields = [
  'employeeNumber',
  'firstName',
  'lastName',
  'preferredName',
  'displayName',
  'workEmail',
  'homeEmail',
  'mobilePhone',
  'homePhone',
  'employmentStatus',
  'ssn',
  'gender',
  'ethnicity',
  'maritalStatus',
  'dateOfBirth',
  'hireDate',
  'terminationDate',
  'department',
  'photoUploaded',
  // location-related
  'location',
  'address1',
  'address2',
  'city',
  'state',
  'zipcode',
  'country',
  // employment-related
  'employmentHistoryStatus',
];
const employeeFetchFieldsCsv = employeeFetchFields.join(',');

export default class BambooHRSyncIntegration extends SyncIntegration<BambooHRSyncPayload> {
  formatter = new BambooHRFormatter();

  public getTitle() {
    return this.config.title;
  }

  get batchSize(): number {
    return 25;
  }

  public async getDestinationSchema(_auth: BambooHRAuthIntegration) {
    return SCHEMA_HRIS;
  }

  public async fetchData(
    auth: BambooHRAuthIntegration,
    args: {
      targetTables?: TARGET_TABLES[];
      targetTableIncrementalValues?: Record<TARGET_TABLES, string>;
    },
  ): Promise<DataObjectStream<SyncRecord>> {
    const stream = new DataObjectStream<SyncRecord>();

    const { targetTableIncrementalValues } = args;

    // Simplified data fetching for BambooHR employees
    void (async () => {
      try {
        const employeeIncrementalValue =
          targetTableIncrementalValues?.[TARGET_TABLES.HRIS_EMPLOYEE];

        const employeeFetchAfter = employeeIncrementalValue
          ? new Date(employeeIncrementalValue).toISOString()
          : '2000-01-01T00:00:00Z';

        let employeeChange: EmployeeChanged = { employees: {}, latest: '' };
        const employeeDetailCacheMap = new Map<string, any>();
        if (args.targetTables?.includes(TARGET_TABLES.HRIS_EMPLOYEE)) {
          this.log(
            `[BambooHR Sync] Fetching employees for company ${auth.config.companyDomain}`,
          );
          employeeChange = (
            await auth.use(async (client) => {
              return await client.get(
                `/employees/changed?since=${employeeFetchAfter}`,
              );
            })
          ).data as EmployeeChanged;
          for (const employee of Object.values(employeeChange.employees).sort(
            (a, b) => a.lastChanged.localeCompare(b.lastChanged),
          )) {
            const { id } = employee;
            // TODO: handle deleted record
            if (employee.action.toLowerCase() === 'deleted') {
              continue;
            }
            try {
              const { data: employeeDetail } = await auth.use(
                async (client) => {
                  return await client.get(
                    `/employees/${id}?fields=${employeeFetchFieldsCsv}`,
                  );
                },
              );

              stream.push({
                recordId: `${employeeDetail.id}`,
                targetTable: TARGET_TABLES.HRIS_EMPLOYEE,
                ...this.formatData(
                  TARGET_TABLES.HRIS_EMPLOYEE,
                  employeeDetail,
                  auth.config.companyDomain,
                ),
              });

              stream.push({
                recordId: `${employeeDetail.id}`,
                targetTable: TARGET_TABLES.HRIS_LOCATION,
                ...this.formatData(
                  TARGET_TABLES.HRIS_LOCATION,
                  employeeDetail,
                  auth.config.companyDomain,
                ),
              });
              employeeDetailCacheMap.set(employeeDetail.id, employeeDetail);
            } catch (ex) {
              if (ex instanceof AxiosError) {
                if (ex.response?.status === 404) {
                  // do nothing
                  // somehow in tests data, some employee id is not found when calling get api
                } else {
                  throw ex;
                }
              } else {
                throw ex;
              }
            }
          }
        }

        const employmentIncrementalValue =
          targetTableIncrementalValues?.[TARGET_TABLES.HRIS_EMPLOYMENT];

        const employmentFetchAfter = employmentIncrementalValue
          ? new Date(employmentIncrementalValue).toISOString()
          : '2000-01-01T00:00:00Z';
        let compensationChange: CompensationTableChanged = {
          employees: {},
          table: '',
        };
        let jobInfoChange: JobInfoTableChanged = {
          employees: {},
          table: '',
        };
        if (args.targetTables?.includes(TARGET_TABLES.HRIS_EMPLOYMENT)) {
          // we get employment table first so when employee is looped, we can get the reference
          compensationChange = (
            await auth.use(async (client) => {
              return await client.get(
                `/employees/changed/tables/compensation?since=${employmentFetchAfter}`,
              );
            })
          ).data as CompensationTableChanged;
          jobInfoChange = (
            await auth.use(async (client) => {
              return await client.get(
                `/employees/changed/tables/jobInfo?since=${employmentFetchAfter}`,
              );
            })
          ).data as JobInfoTableChanged;
        }
        // we map the id to be included in array data
        const jobInfoChangeRows = Object.entries(jobInfoChange.employees).map(
          ([id, jobInfo]) => {
            return {
              employeeId: id,
              ...jobInfo,
            };
          },
        );
        for (const jobInfo of jobInfoChangeRows.sort((a, b) =>
          a.lastChanged.localeCompare(b.lastChanged),
        )) {
          let employeeDetail: any = {};
          if (!employeeDetailCacheMap.has(jobInfo.employeeId)) {
            try {
              const { data } = await auth.use(async (client) => {
                return await client.get(
                  `/employees/${jobInfo.employeeId}?fields=employmentHistoryStatus,lastChanged`,
                );
              });
              employeeDetail = data;
            } catch (ex) {
              if (ex instanceof AxiosError) {
                if (ex.response?.status === 404) {
                  // somehow in tests data, some employee id is not found when calling get api
                  continue;
                } else {
                  throw ex;
                }
              } else {
                throw ex;
              }
            }
          } else {
            employeeDetail = employeeDetailCacheMap.get(jobInfo.employeeId);
          }
          let compensationInfo =
            compensationChange.employees[jobInfo.employeeId];

          if (!compensationInfo) {
            const { data } = (await auth.use(async (client) => {
              return await client.get(
                `/employees/${jobInfo.employeeId}/tables/compensation`,
              );
            })) as { data: any[] };
            compensationInfo = {
              lastChanged: employeeDetail.lastChanged,
              rows: (data ?? []).map((row) => {
                return {
                  ...row,
                  rate: `${row.rate.value} ${row.rate.currency}`,
                  overtimeRate: `${row.overtimeRate.value} ${row.overtimeRate.currency}`,
                };
              }),
              employeeId: jobInfo.employeeId,
            };
          }
          stream.push(
            this.formatter.formatEmployment({
              employee: employeeDetail,
              compensation: compensationInfo,
              jobInfo: jobInfo,
              namespace: auth.config.companyDomain,
            }),
          );
        }

        stream.push(null);
      } catch (error) {
        console.error('[BambooHR Sync] Error fetching data:', error);
        stream.destroy(
          error instanceof Error ? error : new Error(String(error)),
        );
      }
    })();

    return stream;
  }
  formatData(
    targetTable: TARGET_TABLES | string,
    data: any,
    namespace?: string,
  ): { data: SyncRecord; links?: Record<string, SyncLinkValue> } {
    switch (targetTable) {
      case TARGET_TABLES.HRIS_EMPLOYEE:
        return this.formatter.formatEmployee({
          employee: data,
          namespace: namespace!,
        });
      case TARGET_TABLES.HRIS_LOCATION:
        return this.formatter.formatHomeLocation({
          employee: data,
          namespace: namespace!,
        });
      default: {
        return {
          data: {
            RemoteRaw: JSON.stringify(data),
            RemoteNamespace: namespace,
          },
        };
      }
    }
  }

  public getIncrementalKey(targetTable: TARGET_TABLES) {
    switch (targetTable) {
      case TARGET_TABLES.HRIS_EMPLOYEE:
        return 'RemoteUpdatedAt';
      default:
        return 'RemoteUpdatedAt';
    }
  }
}
