import NcProjectBuilder from './NcProjectBuilder';

export default class NcProjectBuilderEE extends NcProjectBuilder {
  public async handleRunTimeChanges(data: any): Promise<any> {
    const curBuilder = this.apiBuilders.find(builder => {
      return (
        (data.req?.dbAlias || data.req?.args?.dbAlias) === builder.getDbAlias()
      );
    });

    switch (data?.req?.api) {
      case 'tableMetaRecreate':
        await curBuilder.onTableMetaRecreate(data.req.args.tn);

        break;

      case 'viewMetaRecreate':
        await curBuilder.onViewDelete(data.req.args.tn);
        await curBuilder.onViewCreate(data.req.args.tn, {});
        break;

      case 'procedureMetaCreate':
        // todo: optimize
        if (Array.isArray(data.req.args.tableNames)) {
          for (const procedure of data.req.args.tableNames) {
            await curBuilder.onProcedureCreate(procedure);
          }
        }
        break;

      case 'functionMetaRecreate':
        await curBuilder.onFunctionDelete(data.req.args.tn);
        await curBuilder.onFunctionCreate(data.req.args.tn);
        break;
      case 'tableMetaCreate':
        // await curBuilder.onTableCreate(data.req.args.tn)
        await curBuilder.xcTablesPopulate({
          tableNames: data.req.args.tableNames.map(tn => ({ tn })),
          type: 'table'
        });
        break;

      case 'viewMetaCreate':
        // await curBuilder.onTableCreate(data.req.args.tn)
        await curBuilder.xcTablesPopulate({
          tableNames: data.req.args.viewNames.map(tn => ({ tn })),
          type: 'view'
        });
        break;

      case 'tableMetaDelete':
        for (const table of data.req.args.tableNames) {
          await curBuilder.onTableDelete(table);
        }
        break;

      case 'viewMetaDelete':
        for (const table of data.req.args.viewNames) {
          await curBuilder.onViewDelete(table);
        }
        break;
      case 'xcRelationsSet':
        await curBuilder.onToggleModelRelation(data.req.args);
        break;

      default:
        return super.handleRunTimeChanges(data);
    }
  }
}

/**
 * @copyright Copyright (c) 2021, Xgene Cloud Ltd
 *
 * @author Naveen MR <oof1lab@gmail.com>
 * @author Pranav C Balan <pranavxc@gmail.com>
 *
 * @license GNU AGPL version 3 or any later version
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program. If not, see <http://www.gnu.org/licenses/>.
 *
 */
