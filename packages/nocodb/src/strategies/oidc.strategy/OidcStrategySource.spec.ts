import { Test } from '@nestjs/testing';
import { OidcStrategy } from './oidc.strategy';
import { UsersService } from '~/services/users/users.service';
import axios from 'axios';

// Mock modules first - before any imports
jest.mock('axios');
jest.mock('~/models');

// Now import mocked modules
import { User, BaseUser } from '~/models';

// We'll access the mocked functions directly from the imports
// after setup

describe('OidcStrategy', () => {
  let oidcStrategy: OidcStrategy;
  const mockUsersService = {
    registerNewUserIfAllowed: jest.fn(),
  };
  const mockNcRequest = {
    ncSiteUrl: 'http://localhost:8080',
    ncBaseId: null,
    context: {},
  };
  
  // Mock data for testing
  const mockAccessToken = 'mock-access-token';
  const mockRefreshToken = 'mock-refresh-token';
  const mockParams = {};
  const mockDone = jest.fn();
  const mockUserInfo = {
    sub: 'user123',
    name: 'Test User',
    email: 'test@example.com',
    email_verified: true
  };
  const mockUser = {
    id: 'user-id',
    email: 'test@example.com',
    roles: 'viewer'
  };

  beforeEach(async () => {
    // Reset all mocks
    jest.clearAllMocks();
    
    // Set environment variables for testing
    process.env.NC_OIDC_USERINFO_URL = 'https://example.com/userinfo';
    
    // Setup mock responses
    (axios.get as jest.Mock).mockResolvedValue({ data: mockUserInfo });
    // Mock User.getByEmail
    (User.getByEmail as jest.Mock).mockResolvedValue(mockUser);
    
    const moduleRef = await Test.createTestingModule({
      providers: [
        OidcStrategy,
        {
          provide: UsersService,
          useValue: mockUsersService,
        },
      ],
    }).compile();

    oidcStrategy = moduleRef.get<OidcStrategy>(OidcStrategy);
  });

  describe('validate', () => {
    it('should be defined', () => {
      expect(oidcStrategy).toBeDefined();
    });
    
    it('should fetch user info and return existing user', async () => {
      await oidcStrategy.validate(
        mockNcRequest as any,
        mockAccessToken,
        mockRefreshToken,
        mockParams,
        mockDone
      );
      
      // Check if it called userinfo endpoint
      expect(axios.get).toHaveBeenCalledWith(
        'https://example.com/userinfo', 
        { headers: { Authorization: `Bearer ${mockAccessToken}` } }
      );
      
      // Check if it looked up the user by email
      expect(User.getByEmail).toHaveBeenCalledWith('test@example.com');
      
      // Check that it returned the user to done callback
      expect(mockDone).toHaveBeenCalledWith(null, expect.anything());
    });
    
    it('should create a new user when user does not exist', async () => {
      // Mock that user doesn't exist
      (User.getByEmail as jest.Mock).mockResolvedValue(null);
      
      // Mock successful user registration
      mockUsersService.registerNewUserIfAllowed.mockResolvedValue({
        id: 'new-user-id',
        email: 'test@example.com'
      });
      
      await oidcStrategy.validate(
        mockNcRequest as any,
        mockAccessToken,
        mockRefreshToken,
        mockParams,
        mockDone
      );
      
      // Check if it tried to register a new user
      expect(mockUsersService.registerNewUserIfAllowed).toHaveBeenCalled();
      expect(mockDone).toHaveBeenCalledWith(null, expect.anything());
    });
    
    it('should fail when userinfo endpoint is not configured', async () => {
      delete process.env.NC_OIDC_USERINFO_URL;
      
      await oidcStrategy.validate(
        mockNcRequest as any,
        mockAccessToken,
        mockRefreshToken,
        mockParams,
        mockDone
      );
      
      // Should call done with an error
      expect(mockDone).toHaveBeenCalledWith(
        expect.objectContaining({ message: expect.stringContaining('Missing NC_OIDC_USERINFO_URL') }),
        null
      );
    });
    
    it('should fail when email is not in user info', async () => {
      // Mock userinfo without email
      (axios.get as jest.Mock).mockResolvedValue({ 
        data: { sub: 'user123', name: 'Test User' } 
      });
      
      await oidcStrategy.validate(
        mockNcRequest as any,
        mockAccessToken,
        mockRefreshToken,
        mockParams,
        mockDone
      );
      
      // Should call done with an error
      expect(mockDone).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Email not found in OIDC profile' }),
        null
      );
    });
  });
});