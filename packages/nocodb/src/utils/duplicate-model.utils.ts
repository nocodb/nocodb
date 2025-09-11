import {
  appendToLength,
  AppendToLengthSuffix,
  type NcContext,
  ProjectRoles,
  SqlUiFactory,
} from 'nocodb-sdk';
import type { DuplicateModelJobData } from '~/interface/Jobs';
import { Base, BaseUser, Model, Source } from '~/models';
import { NcError } from '~/helpers/ncError';

// need to use class to utilize inheritance
export class DuplicateModelUtils {
  static get _() {
    return new DuplicateModelUtils();
  }

  async getTargetContext(
    context: NcContext,
    _options?: DuplicateModelJobData['options'],
  ) {
    return { context, isDifferent: false };
  }

  async verifyTargetContext(
    _sourceContext: NcContext,
    _targetContext: NcContext,
    _modelId: string,
    _options?: DuplicateModelJobData['options'],
  ) {
    return true;
  }

  async getDuplicateModelTaskInfo({
    context,
    baseId,
    modelId,
    body,
  }: {
    context: NcContext;
    baseId: string;
    modelId?: string;
    body: {
      title?: string;
      options?: DuplicateModelJobData['options'];
    };
  }) {
    const base = await Base.get(context, baseId);

    if (!base) {
      throw new Error(`Base not found for id '${baseId}'`);
    }

    const model = await Model.get(context, modelId);

    if (!model) {
      throw new Error(`Model not found!`);
    }
    const sourceSource = await Source.get(context, model.source_id);

    const { context: targetContext, isDifferent: isTargetContextDifferent } =
      await this.getTargetContext(context, body.options);
    await this.verifyTargetContext(
      context,
      targetContext,
      modelId,
      body.options,
    );

    if (isTargetContextDifferent) {
      const baseUser = await BaseUser.get(
        targetContext,
        targetContext.base_id,
        context.user.id,
      );
      if (
        ![ProjectRoles.OWNER, ProjectRoles.CREATOR].includes(
          baseUser.roles as ProjectRoles,
        )
      ) {
        NcError.get(context).forbidden(
          `Only owner or creator can create table at specified base`,
        );
      }
    }

    const targetBase = isTargetContextDifferent
      ? await Base.get(targetContext, targetContext.base_id)
      : base;
    const targetSource = isTargetContextDifferent
      ? (await targetBase.getSources())[0]
      : sourceSource;

    // if data/schema is readonly, then restrict duplication
    if (targetSource.is_schema_readonly) {
      NcError.get(context).sourceMetaReadOnly(targetSource.alias);
    }
    if (targetSource.is_data_readonly) {
      NcError.get(context).sourceDataReadOnly(targetSource.alias);
    }

    const models = await targetSource.getModels(targetContext);
    const tableNameLengthLimit = SqlUiFactory.create({
      client: targetSource.type,
    }).tableNameLengthLimit;
    const uniqueTitle = await appendToLength({
      value: body.title ?? model.title,
      appendage: body.title ? '' : ' copy',
      isExists: async (needle) => models.some((k) => k.title === needle),
      maxLength: tableNameLengthLimit,
      suffix: AppendToLengthSuffix._,
    });

    return {
      uniqueTitle,
      sourceBase: base,
      sourceModel: model,
      sourceSource,
      targetSource,
    };
  }
}
