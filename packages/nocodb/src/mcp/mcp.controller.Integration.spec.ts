import { MCPToken, User } from '~/models';
import { McpController } from '~/mcp/mcp.controller';
import type { NcContext, NcRequest } from 'nocodb-sdk';
import type { McpService } from '~/mcp/mcp.service';

jest.mock('~/models', () => ({
  MCPToken: {
    validateToken: jest.fn(),
  },
  User: {
    getWithRoles: jest.fn(),
  },
}));

jest.mock('~/mcp/mcp.service', () => ({
  McpService: class {},
}));

describe('McpController', () => {
  it('adds the authenticated MCP user to the request context', async () => {
    const mcpService = {
      handleRequest: jest.fn().mockResolvedValue('handled'),
    };
    const controller = new McpController(mcpService as unknown as McpService);
    const context = {
      workspace_id: 'workspace-id',
      base_id: 'base-id',
    } as NcContext;
    const req = {
      headers: { 'xc-mcp-token': 'mcp-token' },
    } as unknown as NcRequest;
    const res = {};
    const user = {
      id: 'user-id',
      email: 'mcp-user@example.test',
      email_verified: true,
      base_roles: { editor: true },
    };

    jest.mocked(MCPToken.validateToken).mockResolvedValue({
      fk_user_id: user.id,
      base_id: context.base_id,
      fk_workspace_id: context.workspace_id,
    } as never);
    jest.mocked(User.getWithRoles).mockResolvedValue(user as never);

    await controller.handleMcpRequest('token-id', req, res, context);

    expect(context.user).toEqual({
      id: user.id,
      email: user.email,
      email_verified: user.email_verified,
    });
    expect(mcpService.handleRequest).toHaveBeenCalledWith(
      'token-id',
      context,
      req,
      res,
    );
  });
});
