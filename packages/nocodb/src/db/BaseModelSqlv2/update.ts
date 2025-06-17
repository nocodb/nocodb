import { NcApiVersion, UITypes } from 'nocodb-sdk';
import type { IBaseModelSqlV2 } from '../IBaseModelSqlV2';
import { NcError } from '~/helpers/ncError';
import { batchUpdate } from '~/utils';

export const baseModelUpdate = (baseModel: IBaseModelSqlV2) => {
  const updateByPk = async (
    id,
    data,
    trx?,
    cookie?,
    _disableOptimization = false,
  ): Promise<any> => {
    try {
      const columns = await baseModel.model.getColumns(baseModel.context);

      const updateObj = await baseModel.model.mapAliasToColumn(
        baseModel.context,
        data,
        baseModel.clientMeta,
        baseModel.dbDriver,
        columns,
      );

      await baseModel.validate(data, columns);

      await baseModel.beforeUpdate(data, trx, cookie);

      const btForeignKeyColumn = columns.find(
        (c) =>
          c.uidt === UITypes.ForeignKey && data[c.column_name] !== undefined,
      );

      const btColumn = btForeignKeyColumn
        ? columns.find(
            (c) =>
              c.uidt === UITypes.LinkToAnotherRecord &&
              c.colOptions?.fk_child_column_id === btForeignKeyColumn.id,
          )
        : null;

      const prevData = await baseModel.readByPk(
        id,
        false,
        {},
        { ignoreView: true, getHiddenColumn: true },
      );

      if (!prevData) {
        NcError._.recordNotFound(id);
      }

      await baseModel.prepareNocoData(updateObj, false, cookie, prevData);

      const query = baseModel
        .dbDriver(baseModel.tnPath)
        .update(updateObj)
        .where(await baseModel._wherePk(id, true));

      await baseModel.execAndParse(query, null, { raw: true });

      const newId = baseModel.extractPksValues(
        {
          ...prevData,
          ...updateObj,
        },
        true,
      );

      const newData = await baseModel.readByPk(
        newId,
        false,
        {},
        { ignoreView: true, getHiddenColumn: true },
      );

      if (btColumn && Object.keys(data || {}).length === 1) {
        await baseModel.addChild({
          colId: btColumn.id,
          rowId: newId,
          childId: updateObj[btForeignKeyColumn.title],
          cookie,
          onlyUpdateAuditLogs: true,
          prevData,
        });
      } else {
        await baseModel.afterUpdate(prevData, newData, trx, cookie, updateObj);
      }
      return newData;
    } catch (e) {
      await baseModel.errorUpdate(e, data, trx, cookie);
      throw e;
    }
  };

  const bulkUpdate = async (
    datas: any[],
    {
      cookie,
      raw = false,
      throwExceptionIfNotExist = false,
      isSingleRecordUpdation = false,
      allowSystemColumn = false,
      typecast = false,
      apiVersion,
      skip_hooks = false,
    }: {
      cookie?: any;
      raw?: boolean;
      throwExceptionIfNotExist?: boolean;
      isSingleRecordUpdation?: boolean;
      allowSystemColumn?: boolean;
      typecast?: boolean;
      apiVersion?: NcApiVersion;
      skip_hooks?: boolean;
    } = {},
  ): Promise<any[]> => {
    let transaction;
    const readChunkSize = 100;

    try {
      const columns = await baseModel.model.getColumns(baseModel.context);

      // validate update data
      if (!raw) {
        for (const d of datas) {
          await baseModel.validate(d, columns, { allowSystemColumn, typecast });
        }
      }

      const updateDatas = raw
        ? datas
        : await Promise.all(
            datas.map((d) =>
              baseModel.model.mapAliasToColumn(
                baseModel.context,
                d,
                baseModel.clientMeta,
                baseModel.dbDriver,
                columns,
              ),
            ),
          );

      const prevData = [];
      const newData = [];
      const updatePkValues = [];
      const toBeUpdated = [];
      const pkAndData: { pk: string; data: any }[] = [];

      for (const d of updateDatas) {
        const pkValues = baseModel.extractPksValues(d, true);

        if (!pkValues) {
          if (throwExceptionIfNotExist) NcError.recordNotFound(pkValues);
          continue;
        }

        pkAndData.push({ pk: pkValues, data: d });
      }

      for (let i = 0; i < pkAndData.length; i += readChunkSize) {
        const chunk = pkAndData.slice(i, i + readChunkSize);
        const pksToRead = chunk.map((v) => v.pk);

        const oldRecords = await baseModel.chunkList({ pks: pksToRead });
        const oldRecordsMap = new Map<string, any>(
          oldRecords.map((r) => [baseModel.extractPksValues(r, true), r]),
        );

        for (const { pk, data } of chunk) {
          const oldRecord = oldRecordsMap.get(pk);

          if (!oldRecord) {
            // removed data from error param, record not found message do not use data
            if (throwExceptionIfNotExist) NcError.recordNotFound(pk);
            continue;
          }

          await baseModel.prepareNocoData(data, false, cookie, oldRecord);
          prevData.push(oldRecord);

          const wherePk = await baseModel._wherePk(pk, true);
          toBeUpdated.push({ d: data, wherePk });

          updatePkValues.push(
            baseModel.extractPksValues(
              {
                ...oldRecord,
                ...data,
              },
              true,
            ),
          );
        }
      }

      transaction = await baseModel.dbDriver.transaction();

      if (
        baseModel.model.primaryKeys.length === 1 &&
        (baseModel.isPg || baseModel.isMySQL || baseModel.isSqlite)
      ) {
        await batchUpdate(
          transaction,
          baseModel.tnPath,
          toBeUpdated.map((o) => o.d),
          baseModel.model.primaryKey.column_name,
        );
      } else {
        for (const o of toBeUpdated) {
          await transaction(baseModel.tnPath).update(o.d).where(o.wherePk);
        }
      }

      await transaction.commit();

      // todo: wrap with transaction
      if (apiVersion === NcApiVersion.V3) {
        for (const d of datas) {
          // remove LTAR/Links if part of the update request
          await baseModel.updateLTARCols({
            rowId: baseModel.extractPksValues(d, true),
            cookie,
            newData: d,
          });
        }
      }

      if (!raw) {
        for (let i = 0; i < updatePkValues.length; i += readChunkSize) {
          const pksChunk = updatePkValues.slice(i, i + readChunkSize);

          const updatedRecords = await baseModel.list(
            { pks: pksChunk.join(',') },
            { limitOverride: pksChunk.length },
          );

          const updatedRecordsMap = new Map(
            updatedRecords.map((record) => [
              baseModel.extractPksValues(record, true),
              record,
            ]),
          );

          for (const pk of pksChunk) {
            if (updatedRecordsMap.has(pk)) {
              newData.push(updatedRecordsMap.get(pk));
            }
          }
        }
      }

      if (!raw && !skip_hooks) {
        if (isSingleRecordUpdation) {
          await baseModel.afterUpdate(
            prevData[0],
            newData[0],
            null,
            cookie,
            datas[0],
          );
        } else {
          await baseModel.afterBulkUpdate(
            prevData,
            newData,
            baseModel.dbDriver,
            cookie,
          );
        }
      }

      return newData;
    } catch (e) {
      if (transaction) await transaction.rollback();
      throw e;
    }
  };

  return {
    updateByPk,
    bulkUpdate,
  };
};
