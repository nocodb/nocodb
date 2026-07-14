import { Test } from '@nestjs/testing';
import type { TestingModule } from '@nestjs/testing';
import { ProjectRoles } from 'nocodb-sdk';
import { SharedBaseAccessRequestsService } from './shared-base-access-requests.service';
import { AppHooksService } from '~/services/app-hooks/app-hooks.service';
import { Base, BaseUser, SharedBaseAccessRequest, User } from '~/models';

jest.mock('~/models', () => ({
  Base: {
    getByUuid: jest.fn(),
    get: jest.fn(),
  },
  BaseUser: {
    get: jest.fn(),
    insert: jest.fn(),
    updateRoles: jest.fn(),
  },
  SharedBaseAccessRequest: {
    get: jest.fn(),
    getByBaseAndUser: jest.fn(),
    listByBase: jest.fn(),
    insert: jest.fn(),
    update: jest.fn(),
  },
  User: {
    get: jest.fn(),
    getWithRoles: jest.fn(),
  },
}));

describe('SharedBaseAccessRequestsService', () => {
  let service: SharedBaseAccessRequestsService;
  const emit = jest.fn();

  const context = { workspace_id: 'ws1', base_id: 'base1' } as any;
  const sharedBase = {
    id: 'base1',
    uuid: 'shared-uuid',
    title: '模版',
    fk_workspace_id: 'ws1',
    default_role: null,
    is_sandbox: false,
  };

  const authReq = {
    user: {
      id: 'user-requester',
      email: 'requester@example.com',
      display_name: 'Requester',
      isAuthorized: true,
    },
  } as any;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SharedBaseAccessRequestsService,
        {
          provide: AppHooksService,
          useValue: { emit, on: jest.fn() },
        },
      ],
    }).compile();

    service = module.get(SharedBaseAccessRequestsService);
    (Base.getByUuid as jest.Mock).mockResolvedValue(sharedBase);
    (Base.get as jest.Mock).mockResolvedValue(sharedBase);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('rejects unauthenticated create', async () => {
    await expect(
      service.create(context, {
        sharedBaseUuid: 'shared-uuid',
        req: { user: null } as any,
      }),
    ).rejects.toMatchObject({ error: expect.anything() });
  });

  it('returns already_has_access when requester is already editor+', async () => {
    (User.getWithRoles as jest.Mock).mockResolvedValue({
      base_roles: { [ProjectRoles.EDITOR]: true },
    });

    const result = await service.create(context, {
      sharedBaseUuid: 'shared-uuid',
      req: authReq,
    });

    expect(result).toEqual({
      already_has_access: true,
      base_id: 'base1',
      fk_workspace_id: 'ws1',
      status: 'approved',
    });
    expect(SharedBaseAccessRequest.insert).not.toHaveBeenCalled();
  });

  it('is idempotent for an existing pending request', async () => {
    (User.getWithRoles as jest.Mock).mockResolvedValue({ base_roles: null });
    (SharedBaseAccessRequest.getByBaseAndUser as jest.Mock).mockResolvedValue({
      id: 'req1',
      base_id: 'base1',
      fk_user_id: 'user-requester',
      status: 'pending',
      requested_role: 'editor',
    });

    const result = await service.create(context, {
      sharedBaseUuid: 'shared-uuid',
      req: authReq,
    });

    expect(result.status).toBe('pending');
    expect(result.already_pending).toBe(true);
    expect(SharedBaseAccessRequest.insert).not.toHaveBeenCalled();
    expect(emit).not.toHaveBeenCalled();
  });

  it('reopens a rejected request as pending', async () => {
    (User.getWithRoles as jest.Mock).mockResolvedValue({ base_roles: null });
    (SharedBaseAccessRequest.getByBaseAndUser as jest.Mock).mockResolvedValue({
      id: 'req1',
      base_id: 'base1',
      fk_user_id: 'user-requester',
      status: 'rejected',
      requested_role: 'editor',
    });
    (SharedBaseAccessRequest.update as jest.Mock).mockResolvedValue({
      id: 'req1',
      base_id: 'base1',
      fk_user_id: 'user-requester',
      status: 'pending',
      requested_role: 'editor',
      message: 'please',
    });

    const result = await service.create(context, {
      sharedBaseUuid: 'shared-uuid',
      message: 'please',
      req: authReq,
    });

    expect(SharedBaseAccessRequest.update).toHaveBeenCalledWith(
      expect.objectContaining({ base_id: 'base1' }),
      'req1',
      expect.objectContaining({ status: 'pending', message: 'please' }),
    );
    expect(result.status).toBe('pending');
    expect(emit).toHaveBeenCalled();
  });

  it('rejects create when shared link uuid is missing / private base', async () => {
    (Base.getByUuid as jest.Mock).mockResolvedValue({
      ...sharedBase,
      uuid: null,
    });

    await expect(
      service.create(context, {
        sharedBaseUuid: 'shared-uuid',
        req: authReq,
      }),
    ).rejects.toBeTruthy();
  });

  it('approves pending request and grants BaseUser.editor', async () => {
    (SharedBaseAccessRequest.get as jest.Mock).mockResolvedValue({
      id: 'req1',
      base_id: 'base1',
      fk_user_id: 'user-requester',
      status: 'pending',
      requested_role: 'editor',
    });
    (BaseUser.get as jest.Mock).mockResolvedValue(null);
    (BaseUser.insert as jest.Mock).mockResolvedValue({});
    (SharedBaseAccessRequest.update as jest.Mock).mockResolvedValue({
      id: 'req1',
      base_id: 'base1',
      fk_user_id: 'user-requester',
      status: 'approved',
      requested_role: 'editor',
    });
    (User.get as jest.Mock).mockResolvedValue({
      id: 'user-requester',
      email: 'requester@example.com',
    });

    const result = await service.approve(context, {
      baseId: 'base1',
      requestId: 'req1',
      req: {
        user: { id: 'owner1', email: 'owner@example.com' },
      } as any,
    });

    expect(BaseUser.insert).toHaveBeenCalledWith(
      expect.objectContaining({ base_id: 'base1' }),
      expect.objectContaining({
        base_id: 'base1',
        fk_user_id: 'user-requester',
        roles: ProjectRoles.EDITOR,
      }),
    );
    expect(result.status).toBe('approved');
  });

  it('rejects approving a non-pending request', async () => {
    (SharedBaseAccessRequest.get as jest.Mock).mockResolvedValue({
      id: 'req1',
      base_id: 'base1',
      fk_user_id: 'user-requester',
      status: 'approved',
    });

    await expect(
      service.approve(context, {
        baseId: 'base1',
        requestId: 'req1',
        req: { user: { id: 'owner1' } } as any,
      }),
    ).rejects.toBeTruthy();
    expect(BaseUser.insert).not.toHaveBeenCalled();
  });

  it('handles concurrent approve races by failing the second pending check', async () => {
    (SharedBaseAccessRequest.get as jest.Mock)
      .mockResolvedValueOnce({
        id: 'req1',
        base_id: 'base1',
        fk_user_id: 'user-requester',
        status: 'pending',
      })
      .mockResolvedValueOnce({
        id: 'req1',
        base_id: 'base1',
        fk_user_id: 'user-requester',
        status: 'approved',
      });
    (BaseUser.get as jest.Mock).mockResolvedValue(null);
    (BaseUser.insert as jest.Mock).mockResolvedValue({});
    (SharedBaseAccessRequest.update as jest.Mock).mockResolvedValue({
      id: 'req1',
      status: 'approved',
      base_id: 'base1',
      fk_user_id: 'user-requester',
    });
    (User.get as jest.Mock).mockResolvedValue({ id: 'user-requester' });

    await service.approve(context, {
      baseId: 'base1',
      requestId: 'req1',
      req: { user: { id: 'owner1' } } as any,
    });

    await expect(
      service.approve(context, {
        baseId: 'base1',
        requestId: 'req1',
        req: { user: { id: 'owner2' } } as any,
      }),
    ).rejects.toBeTruthy();
  });
});
