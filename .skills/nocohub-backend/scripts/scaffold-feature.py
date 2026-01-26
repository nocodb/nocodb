#!/usr/bin/env python3
"""
NocoDB Backend Feature Scaffolder

Generates controller, service, model, spec, and migration files for a new feature.

Usage:
    python scaffold-feature.py <feature_name> [--ee] [--no-migration]

Examples:
    python scaffold-feature.py bookmark
    python scaffold-feature.py workspace-settings --ee
    python scaffold-feature.py tag --no-migration
"""

import argparse
import os
import re
from datetime import datetime
from pathlib import Path


def to_pascal_case(name: str) -> str:
    """Convert kebab-case or snake_case to PascalCase"""
    return ''.join(word.capitalize() for word in re.split(r'[-_]', name))


def to_camel_case(name: str) -> str:
    """Convert kebab-case or snake_case to camelCase"""
    pascal = to_pascal_case(name)
    return pascal[0].lower() + pascal[1:]


def to_snake_case(name: str) -> str:
    """Convert kebab-case to snake_case"""
    return name.replace('-', '_')


def to_upper_snake_case(name: str) -> str:
    """Convert to UPPER_SNAKE_CASE"""
    return to_snake_case(name).upper()


CONTROLLER_TEMPLATE = '''import {{
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
}} from '@nestjs/common';
import {{ GlobalGuard }} from '~/guards/global/global.guard';
import {{ MetaApiLimiterGuard }} from '~/guards/meta-api-limiter.guard';
import {{ PagedResponseImpl }} from '~/helpers/PagedResponse';
import {{ Acl }} from '~/middlewares/extract-ids/extract-ids.middleware';
import {{ NcRequest }} from '~/interface/config';
import {{ {pascal}Service }} from '~/services/{kebab}.service';

@Controller()
@UseGuards(MetaApiLimiterGuard, GlobalGuard)
export class {pascal}Controller {{
  constructor(private readonly {camel}Service: {pascal}Service) {{}}

  @Get(['/api/v1/db/meta/bases/:baseId/{kebab}s', '/api/v2/meta/bases/:baseId/{kebab}s'])
  @Acl('{camel}List')
  async list(@Req() req: NcRequest) {{
    return new PagedResponseImpl(
      await this.{camel}Service.list({{ baseId: req.ncBaseId, req }}),
    );
  }}

  @Get(['/api/v1/db/meta/{kebab}s/:id', '/api/v2/meta/{kebab}s/:id'])
  @Acl('{camel}Read')
  async get(@Param('id') id: string, @Req() req: NcRequest) {{
    return await this.{camel}Service.get({{ id, req }});
  }}

  @Post(['/api/v1/db/meta/bases/:baseId/{kebab}s', '/api/v2/meta/bases/:baseId/{kebab}s'])
  @HttpCode(200)
  @Acl('{camel}Create')
  async create(@Req() req: NcRequest, @Body() body) {{
    return await this.{camel}Service.create({{
      baseId: req.ncBaseId,
      {camel}: body,
      userId: req['user'].id,
      req,
    }});
  }}

  @Patch(['/api/v1/db/meta/{kebab}s/:id', '/api/v2/meta/{kebab}s/:id'])
  @Acl('{camel}Update')
  async update(@Param('id') id: string, @Body() body, @Req() req: NcRequest) {{
    return await this.{camel}Service.update({{ id, {camel}: body, req }});
  }}

  @Delete(['/api/v1/db/meta/{kebab}s/:id', '/api/v2/meta/{kebab}s/:id'])
  @Acl('{camel}Delete')
  async delete(@Param('id') id: string, @Req() req: NcRequest) {{
    return await this.{camel}Service.delete({{ id, req }});
  }}
}}
'''

SERVICE_TEMPLATE = '''import {{ Injectable }} from '@nestjs/common';
import {{ AppEvents }} from 'nocodb-sdk';
import type {{ NcRequest }} from '~/interface/config';
import {{ AppHooksService }} from '~/services/app-hooks/app-hooks.service';
import {{ NcError }} from '~/helpers/catchError';
import {{ validatePayload }} from '~/helpers';
import {{ {pascal} }} from '~/models';

@Injectable()
export class {pascal}Service {{
  constructor(protected readonly appHooksService: AppHooksService) {{}}

  async list(param: {{ baseId: string; req: NcRequest }}) {{
    return await {pascal}.list(param.baseId);
  }}

  async get(param: {{ id: string; req: NcRequest }}) {{
    const {camel} = await {pascal}.get(param.id);
    if (!{camel}) {{
      NcError.notFound('{pascal} not found');
    }}
    return {camel};
  }}

  async create(param: {{
    baseId: string;
    {camel}: any;
    userId: string;
    req: NcRequest;
  }}) {{
    validatePayload('swagger.json#/components/schemas/{pascal}Req', param.{camel});

    const {camel} = await {pascal}.insert({{
      ...param.{camel},
      fk_base_id: param.baseId,
      fk_user_id: param.userId,
    }});

    this.appHooksService.emit(AppEvents.{upper_snake}_CREATE, {{
      {camel},
      userId: param.userId,
      req: param.req,
    }});

    return {camel};
  }}

  async update(param: {{ id: string; {camel}: any; req: NcRequest }}) {{
    validatePayload('swagger.json#/components/schemas/{pascal}Req', param.{camel});

    const existing = await {pascal}.get(param.id);
    if (!existing) {{
      NcError.notFound('{pascal} not found');
    }}

    await {pascal}.update(param.id, param.{camel});

    this.appHooksService.emit(AppEvents.{upper_snake}_UPDATE, {{
      id: param.id,
      {camel}: param.{camel},
      req: param.req,
    }});

    return await {pascal}.get(param.id);
  }}

  async delete(param: {{ id: string; req: NcRequest }}) {{
    const {camel} = await {pascal}.get(param.id);
    if (!{camel}) {{
      NcError.notFound('{pascal} not found');
    }}

    await {pascal}.delete(param.id);

    this.appHooksService.emit(AppEvents.{upper_snake}_DELETE, {{
      id: param.id,
      req: param.req,
    }});

    return true;
  }}
}}
'''

SERVICE_SPEC_TEMPLATE = '''import {{ Test }} from '@nestjs/testing';
import {{ {pascal}Service }} from './{kebab}.service';
import type {{ TestingModule }} from '@nestjs/testing';

describe('{pascal}Service', () => {{
  let service: {pascal}Service;

  beforeEach(async () => {{
    const module: TestingModule = await Test.createTestingModule({{
      providers: [{pascal}Service],
    }}).compile();

    service = module.get<{pascal}Service>({pascal}Service);
  }});

  it('should be defined', () => {{
    expect(service).toBeDefined();
  }});
}});
'''

MODEL_TEMPLATE = '''import type {{ {pascal}Type }} from 'nocodb-sdk';
import {{
  CacheDelDirection,
  CacheGetType,
  CacheScope,
  MetaTable,
  RootScopes,
}} from '~/utils/globals';
import Noco from '~/Noco';
import NocoCache from '~/cache/NocoCache';
import {{ extractProps }} from '~/helpers/extractProps';

export default class {pascal} implements {pascal}Type {{
  id?: string;
  title?: string;
  description?: string;
  fk_base_id?: string;
  fk_user_id?: string;
  meta?: Record<string, any>;
  created_at?: string;
  updated_at?: string;

  constructor(data: Partial<{pascal}>) {{
    Object.assign(this, data);
  }}

  public static async insert(data: Partial<{pascal}>, ncMeta = Noco.ncMeta) {{
    const insertObj = extractProps(data, [
      'title',
      'description',
      'fk_base_id',
      'fk_user_id',
      'meta',
    ]);

    const {{ id }} = await ncMeta.metaInsert2(
      data.fk_base_id ? data.fk_base_id : RootScopes.ROOT,
      RootScopes.ROOT,
      MetaTable.{upper_snake}S,
      insertObj,
      true,
    );

    return this.get(id, ncMeta);
  }}

  public static async get(id: string, ncMeta = Noco.ncMeta): Promise<{pascal} | null> {{
    let data = await NocoCache.get(
      RootScopes.ROOT,
      `${{CacheScope.{upper_snake}}}:${{id}}`,
      CacheGetType.TYPE_OBJECT,
    );

    if (!data) {{
      data = await ncMeta.metaGet2(
        RootScopes.ROOT,
        RootScopes.ROOT,
        MetaTable.{upper_snake}S,
        id,
      );

      if (data) {{
        await NocoCache.set(RootScopes.ROOT, `${{CacheScope.{upper_snake}}}:${{id}}`, data);
      }}
    }}

    return data && this.castType(data);
  }}

  public static async list(baseId: string, ncMeta = Noco.ncMeta): Promise<{pascal}[]> {{
    const list = await ncMeta.metaList2(
      RootScopes.ROOT,
      RootScopes.ROOT,
      MetaTable.{upper_snake}S,
      {{ condition: {{ fk_base_id: baseId }} }},
    );

    return list.map((item) => this.castType(item));
  }}

  public static async update(id: string, data: Partial<{pascal}>, ncMeta = Noco.ncMeta) {{
    const updateObj = extractProps(data, ['title', 'description', 'meta']);

    await ncMeta.metaUpdate(
      RootScopes.ROOT,
      RootScopes.ROOT,
      MetaTable.{upper_snake}S,
      updateObj,
      id,
    );

    await NocoCache.del(RootScopes.ROOT, `${{CacheScope.{upper_snake}}}:${{id}}`);

    return this.get(id, ncMeta);
  }}

  public static async delete(id: string, ncMeta = Noco.ncMeta) {{
    await NocoCache.deepDel(
      RootScopes.ROOT,
      `${{CacheScope.{upper_snake}}}:${{id}}`,
      CacheDelDirection.CHILD_TO_PARENT,
    );

    return await ncMeta.metaDelete(
      RootScopes.ROOT,
      RootScopes.ROOT,
      MetaTable.{upper_snake}S,
      id,
    );
  }}

  public static castType(data: {pascal}): {pascal} {{
    return data && new {pascal}(data);
  }}
}}
'''

MIGRATION_TEMPLATE = '''import type {{ Knex }} from 'knex';
import {{ MetaTable }} from '~/utils/globals';

const up = async (knex: Knex) => {{
  await knex.schema.createTable(MetaTable.{upper_snake}S, (table) => {{
    table.string('id', 20).primary();
    table.string('title', 255).notNullable();
    table.text('description');
    table.string('fk_base_id', 20);
    table.string('fk_user_id', 20);
    table.text('meta');
    table.timestamps(true, true);

    table.index('fk_base_id');
    table.index('fk_user_id');
    table.index('created_at');
  }});
}};

const down = async (knex: Knex) => {{
  await knex.schema.dropTableIfExists(MetaTable.{upper_snake}S);
}};

export {{ up, down }};
'''

EE_SERVICE_TEMPLATE = '''import {{ Injectable }} from '@nestjs/common';
import {{ {pascal}Service as {pascal}ServiceCE }} from 'src/services/{kebab}.service';
import type {{ NcRequest }} from '~/interface/config';
import {{ AppHooksService }} from '~/services/app-hooks/app-hooks.service';

@Injectable()
export class {pascal}Service extends {pascal}ServiceCE {{
  constructor(protected readonly appHooksService: AppHooksService) {{
    super(appHooksService);
  }}

  // Override CE methods or add EE-specific methods here
}}
'''

EE_SERVICE_SPEC_TEMPLATE = '''import {{ Test }} from '@nestjs/testing';
import {{ {pascal}Service }} from './{kebab}.service';
import type {{ TestingModule }} from '@nestjs/testing';

describe('{pascal}Service (EE)', () => {{
  let service: {pascal}Service;

  beforeEach(async () => {{
    const module: TestingModule = await Test.createTestingModule({{
      providers: [{pascal}Service],
    }}).compile();

    service = module.get<{pascal}Service>({pascal}Service);
  }});

  it('should be defined', () => {{
    expect(service).toBeDefined();
  }});
}});
'''


def get_next_migration_number(migrations_dir: Path) -> str:
    """Get the next migration number based on existing migrations"""
    existing = list(migrations_dir.glob('nc_*.ts'))
    if not existing:
        return '099'

    numbers = []
    for f in existing:
        match = re.match(r'nc_(\d+)_', f.name)
        if match:
            numbers.append(int(match.group(1)))

    if numbers:
        return str(max(numbers) + 1).zfill(3)
    return '099'


def scaffold_feature(name: str, ee: bool = False, create_migration: bool = True, base_path: str = None):
    """Scaffold all files for a new feature"""

    pascal = to_pascal_case(name)
    camel = to_camel_case(name)
    kebab = name.lower()
    snake = to_snake_case(name)
    upper_snake = to_upper_snake_case(name)

    context = {
        'pascal': pascal,
        'camel': camel,
        'kebab': kebab,
        'snake': snake,
        'upper_snake': upper_snake,
    }

    # Determine base path
    if base_path:
        nocodb_src = Path(base_path)
    else:
        # Try to find the nocodb package
        cwd = Path.cwd()
        if (cwd / 'packages/nocodb/src').exists():
            nocodb_src = cwd / 'packages/nocodb/src'
        elif (cwd / 'src/controllers').exists():
            nocodb_src = cwd / 'src'
        else:
            nocodb_src = cwd

    files_created = []

    # CE files
    ce_controller_path = nocodb_src / 'controllers' / f'{kebab}.controller.ts'
    ce_service_path = nocodb_src / 'services' / f'{kebab}.service.ts'
    ce_spec_path = nocodb_src / 'services' / f'{kebab}.service.spec.ts'
    ce_model_path = nocodb_src / 'models' / f'{pascal}.ts'

    # Create CE files
    if not ce_controller_path.exists():
        ce_controller_path.parent.mkdir(parents=True, exist_ok=True)
        ce_controller_path.write_text(CONTROLLER_TEMPLATE.format(**context))
        files_created.append(str(ce_controller_path))

    if not ce_service_path.exists():
        ce_service_path.parent.mkdir(parents=True, exist_ok=True)
        ce_service_path.write_text(SERVICE_TEMPLATE.format(**context))
        files_created.append(str(ce_service_path))

    if not ce_spec_path.exists():
        ce_spec_path.write_text(SERVICE_SPEC_TEMPLATE.format(**context))
        files_created.append(str(ce_spec_path))

    if not ce_model_path.exists():
        ce_model_path.parent.mkdir(parents=True, exist_ok=True)
        ce_model_path.write_text(MODEL_TEMPLATE.format(**context))
        files_created.append(str(ce_model_path))

    # Migration
    if create_migration:
        migrations_dir = nocodb_src / 'meta/migrations/v2'
        if migrations_dir.exists():
            migration_num = get_next_migration_number(migrations_dir)
            migration_path = migrations_dir / f'nc_{migration_num}_{snake}.ts'
            if not migration_path.exists():
                migration_path.write_text(MIGRATION_TEMPLATE.format(**context))
                files_created.append(str(migration_path))

    # EE files
    if ee:
        ee_service_path = nocodb_src / 'ee/services' / f'{kebab}.service.ts'
        ee_spec_path = nocodb_src / 'ee/services' / f'{kebab}.service.spec.ts'

        if not ee_service_path.exists():
            ee_service_path.parent.mkdir(parents=True, exist_ok=True)
            ee_service_path.write_text(EE_SERVICE_TEMPLATE.format(**context))
            files_created.append(str(ee_service_path))

        if not ee_spec_path.exists():
            ee_spec_path.write_text(EE_SERVICE_SPEC_TEMPLATE.format(**context))
            files_created.append(str(ee_spec_path))

    return files_created, context


def main():
    parser = argparse.ArgumentParser(
        description='Scaffold a new NocoDB backend feature',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog='''
Examples:
  %(prog)s bookmark              # Create CE feature "bookmark"
  %(prog)s workspace-tag --ee    # Create CE + EE feature "workspaceTag"
  %(prog)s note --no-migration   # Create feature without migration

After scaffolding:
  1. Add MetaTable.{FEATURE}S to src/utils/globals.ts
  2. Add CacheScope.{FEATURE} to src/utils/globals.ts
  3. Register controller & service in src/modules/noco.module.ts
  4. (If EE) Register EE service in src/ee/modules/noco.module.ts
  5. Add migration import to XcMigrationSourcev2.ts
        '''
    )
    parser.add_argument('name', help='Feature name in kebab-case (e.g., "bookmark" or "workspace-tag")')
    parser.add_argument('--ee', action='store_true', help='Also create EE extension files')
    parser.add_argument('--no-migration', action='store_true', help='Skip migration file creation')
    parser.add_argument('--path', help='Base path to nocodb/src directory')

    args = parser.parse_args()

    files_created, context = scaffold_feature(
        args.name,
        ee=args.ee,
        create_migration=not args.no_migration,
        base_path=args.path
    )

    if files_created:
        print(f"\n✅ Scaffolded feature: {context['pascal']}")
        print("\nFiles created:")
        for f in files_created:
            print(f"  - {f}")

        print("\n📋 Next steps:")
        print(f"  1. Add MetaTable.{context['upper_snake']}S = 'nc_{context['snake']}s' to src/utils/globals.ts")
        print(f"  2. Add CacheScope.{context['upper_snake']} = '{context['camel']}' to src/utils/globals.ts")
        print(f"  3. Register {context['pascal']}Controller in src/modules/noco.module.ts controllers[]")
        print(f"  4. Register {context['pascal']}Service in src/modules/noco.module.ts providers[]")
        if args.ee:
            print(f"  5. Register EE {context['pascal']}Service in src/ee/modules/noco.module.ts")
        if not args.no_migration:
            print(f"  6. Add migration import to XcMigrationSourcev2.ts")
    else:
        print("No files were created (all files already exist)")


if __name__ == '__main__':
    main()
