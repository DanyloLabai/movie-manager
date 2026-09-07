import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../users.service';
import { User } from '../users.entity';
import { FriendRequest } from '../friend-request.entity';
import { MoviesService } from '../../movies/movies.service';
import { ActivityService } from '../../activity/activity.service';
import { VectorService } from '../../vector/vector.service';
import { SearchHistoryService } from '../../search-history/search-history.service';
import { NotificationsService } from '../../notifications/notifications.service';

jest.mock('cloudinary', () => ({
  v2: {
    config: jest.fn(),
    uploader: {
      upload_stream: jest.fn(),
    },
  },
}));

jest.mock('streamifier', () => ({
  createReadStream: jest.fn().mockReturnValue({
    pipe: jest.fn(),
  }),
}));

const buildUser = (overrides: Partial<User> = {}): User =>
  ({
    id: 1,
    username: 'testuser',
    email: 'test@example.com',
    password: 'hashed',
    avatarUrl: null,
    isVerified: true,
    verificationToken: null,
    resetToken: null,
    friends: [],
    watchlist: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }) as User;

const mockUsersRepository = {
  findOne: jest.fn(),
  save: jest.fn(),
  update: jest.fn(),
};

const mockMoviesService = {
  getProfileData: jest.fn(),
};

const mockActivityService = {
  getFriendsFeed: jest.fn(),
};

const mockVectorService = {
  computeTasteCompatibility: jest.fn(),
};

const mockNotificationsService = {
  notify: jest.fn().mockResolvedValue(undefined),
};

const mockSearchHistoryService = {
  getRecentQueries: jest.fn(),
};

const mockFriendRequestRepository = {
  findOne: jest.fn(),
  find: jest.fn(),
  create: jest.fn((data: Partial<FriendRequest>) => data),
  save: jest.fn(),
  remove: jest.fn(),
};

const mockConfigService = {
  get: jest.fn((key: string) => {
    const config: Record<string, string> = {
      CLOUDINARY_CLOUD_NAME: 'test-cloud',
      CLOUDINARY_API_KEY: 'test-key',
      CLOUDINARY_API_SECRET: 'test-secret',
    };
    return config[key];
  }),
};

describe('UsersService', () => {
  let service: UsersService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: getRepositoryToken(User), useValue: mockUsersRepository },
        {
          provide: getRepositoryToken(FriendRequest),
          useValue: mockFriendRequestRepository,
        },
        { provide: MoviesService, useValue: mockMoviesService },
        { provide: ActivityService, useValue: mockActivityService },
        { provide: VectorService, useValue: mockVectorService },
        { provide: NotificationsService, useValue: mockNotificationsService },
        { provide: SearchHistoryService, useValue: mockSearchHistoryService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    jest.clearAllMocks();
  });

  describe('updateTimezone', () => {
    it('should save a valid IANA timezone', async () => {
      mockUsersRepository.update.mockResolvedValue({ affected: 1 });

      const result = await service.updateTimezone(1, 'America/New_York');

      expect(result).toEqual({ timezone: 'America/New_York' });
      expect(mockUsersRepository.update).toHaveBeenCalledWith(1, {
        timezone: 'America/New_York',
      });
    });

    it('should throw BadRequestException for an invalid timezone', async () => {
      await expect(
        service.updateTimezone(1, 'Not/A_Zone'),
      ).rejects.toThrow(BadRequestException);
      expect(mockUsersRepository.update).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException for an empty timezone', async () => {
      await expect(service.updateTimezone(1, '')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('getUserTimeZone', () => {
    it("should return the user's stored timezone when set", async () => {
      mockUsersRepository.findOne.mockResolvedValue(
        buildUser({ timezone: 'America/New_York' }),
      );

      const result = await service.getUserTimeZone(1);

      expect(result).toBe('America/New_York');
    });

    it('should fall back to the app default when unset', async () => {
      mockUsersRepository.findOne.mockResolvedValue(
        buildUser({ timezone: null }),
      );

      const result = await service.getUserTimeZone(1);

      expect(result).toBe('Europe/Kyiv');
    });

    it('should fall back to the app default when the user is not found', async () => {
      mockUsersRepository.findOne.mockResolvedValue(null);

      const result = await service.getUserTimeZone(99);

      expect(result).toBe('Europe/Kyiv');
    });
  });

  describe('updateUserProfile', () => {
    it('should update username successfully', async () => {
      const user = buildUser();
      mockUsersRepository.findOne.mockResolvedValue(user);
      mockUsersRepository.save.mockResolvedValue({
        ...user,
        username: 'newname',
      });

      const result = await service.updateUserProfile(1, 'newname');

      expect(result.username).toBe('newname');
    });

    it('should throw NotFoundException when user does not exist', async () => {
      mockUsersRepository.findOne.mockResolvedValue(null);

      await expect(service.updateUserProfile(99, 'name')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw BadRequestException for invalid username characters', async () => {
      mockUsersRepository.findOne.mockResolvedValue(buildUser());

      await expect(
        service.updateUserProfile(1, 'invalid name!'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw ConflictException when username is already taken', async () => {
      const currentUser = buildUser({ id: 1, username: 'original' });
      const otherUser = buildUser({ id: 2, username: 'taken' });

      mockUsersRepository.findOne
        .mockResolvedValueOnce(currentUser)
        .mockResolvedValueOnce(otherUser);

      await expect(service.updateUserProfile(1, 'taken')).rejects.toThrow(
        ConflictException,
      );
    });

    it('should allow keeping the same username (case-insensitive match skips conflict check)', async () => {
      const user = buildUser({ username: 'TestUser' });
      mockUsersRepository.findOne.mockResolvedValue(user);
      mockUsersRepository.save.mockResolvedValue(user);

      const result = await service.updateUserProfile(1, 'testuser');

      expect(result.username).toBe('TestUser');
    });

    it('should not call findOne for duplicate check when username matches own (same user)', async () => {
      const user = buildUser({ username: 'MyUser' });
      mockUsersRepository.findOne.mockResolvedValue(user);
      mockUsersRepository.save.mockResolvedValue(user);

      await service.updateUserProfile(1, 'myuser');

      expect(mockUsersRepository.findOne).toHaveBeenCalledTimes(1);
    });
  });

  describe('getFriends', () => {
    it('should return friend list with id, username, and avatarUrl', async () => {
      const friend = buildUser({
        id: 2,
        username: 'friend1',
        avatarUrl: '/avatar.jpg',
      });
      const user = buildUser({ friends: [friend] });
      mockUsersRepository.findOne.mockResolvedValue(user);

      const result = await service.getFriends(1);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        id: 2,
        username: 'friend1',
        avatarUrl: '/avatar.jpg',
      });
    });

    it('should return empty array when user has no friends', async () => {
      mockUsersRepository.findOne.mockResolvedValue(buildUser({ friends: [] }));

      const result = await service.getFriends(1);

      expect(result).toEqual([]);
    });

    it('should throw NotFoundException when user does not exist', async () => {
      mockUsersRepository.findOne.mockResolvedValue(null);

      await expect(service.getFriends(99)).rejects.toThrow(NotFoundException);
    });
  });

  describe('addFriend', () => {
    it('should create a pending friend request when neither side has requested yet', async () => {
      const user1 = buildUser({ id: 1, friends: [] });
      const user2 = buildUser({ id: 2, friends: [] });

      mockUsersRepository.findOne
        .mockResolvedValueOnce(user1)
        .mockResolvedValueOnce(user2);
      mockFriendRequestRepository.findOne
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null);

      const result = await service.addFriend(1, 2);

      expect(result.message).toBe('Friend request sent');
      expect(result.status).toBe('pending');
      expect(mockFriendRequestRepository.save).toHaveBeenCalled();
      expect(mockUsersRepository.save).not.toHaveBeenCalled();
    });

    it('should auto-accept and become friends when the other user already sent a request', async () => {
      const user1 = buildUser({ id: 1, friends: [] });
      const user2 = buildUser({ id: 2, friends: [] });

      mockUsersRepository.findOne
        .mockResolvedValueOnce(user1)
        .mockResolvedValueOnce(user2)
        .mockResolvedValueOnce(user1)
        .mockResolvedValueOnce(user2);
      const incomingRequest = { id: 5, fromUser: user2, toUser: user1 };
      mockFriendRequestRepository.findOne.mockResolvedValueOnce(
        incomingRequest,
      );
      mockUsersRepository.save.mockResolvedValue([]);

      const result = await service.addFriend(1, 2);

      expect(result.message).toBe('Friend added successfully');
      expect(result.status).toBe('accepted');
      expect(mockFriendRequestRepository.remove).toHaveBeenCalledWith(
        incomingRequest,
      );
      expect(mockUsersRepository.save).toHaveBeenCalledWith([
        expect.objectContaining({
          id: 1,
          friends: expect.arrayContaining([user2]) as User[],
        }),
        expect.objectContaining({
          id: 2,
          friends: expect.arrayContaining([user1]) as User[],
        }),
      ]);
    });

    it('should throw BadRequestException when trying to add yourself', async () => {
      await expect(service.addFriend(1, 1)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw NotFoundException when either user does not exist', async () => {
      mockUsersRepository.findOne
        .mockResolvedValueOnce(buildUser())
        .mockResolvedValueOnce(null);

      await expect(service.addFriend(1, 999)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw BadRequestException if users are already friends', async () => {
      const user2 = buildUser({ id: 2 });
      const user1 = buildUser({ id: 1, friends: [user2] });

      mockUsersRepository.findOne
        .mockResolvedValueOnce(user1)
        .mockResolvedValueOnce(user2);

      await expect(service.addFriend(1, 2)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException when a request was already sent', async () => {
      const user1 = buildUser({ id: 1, friends: [] });
      const user2 = buildUser({ id: 2, friends: [] });

      mockUsersRepository.findOne
        .mockResolvedValueOnce(user1)
        .mockResolvedValueOnce(user2);
      mockFriendRequestRepository.findOne
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ id: 7 });

      await expect(service.addFriend(1, 2)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('removeFriend', () => {
    it('should remove friend from both sides', async () => {
      const user2 = buildUser({ id: 2, friends: [] });
      const user1 = buildUser({ id: 1, friends: [user2] });
      user2.friends = [user1];

      mockUsersRepository.findOne
        .mockResolvedValueOnce(user1)
        .mockResolvedValueOnce(user2);

      mockUsersRepository.save.mockResolvedValue([]);

      const result = await service.removeFriend(1, 2);

      expect(result.message).toBe('Friend removed successfully');
      expect(user1.friends.find((f) => f.id === 2)).toBeUndefined();
      expect(user2.friends.find((f) => f.id === 1)).toBeUndefined();
    });

    it('should throw NotFoundException if either user does not exist', async () => {
      mockUsersRepository.findOne
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null);

      await expect(service.removeFriend(1, 2)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getPublicProfile', () => {
    it('should return profile stats with isFriend = true when users are friends', async () => {
      const currentUser = buildUser({ id: 2 });
      const targetUser = buildUser({ id: 1, friends: [currentUser] });
      const profileStats = { watchedCount: 42, favoriteGenre: 'Action' };

      mockUsersRepository.findOne.mockResolvedValue(targetUser);
      mockMoviesService.getProfileData.mockResolvedValue(profileStats);

      const result = await service.getPublicProfile(1, 2);

      expect(result.isFriend).toBe(true);
      expect(result.requestPending).toBe(false);
      expect(result.watchedCount).toBe(42);
    });

    it('should return isFriend = false when users are not friends', async () => {
      const targetUser = buildUser({ id: 1, friends: [] });
      mockUsersRepository.findOne.mockResolvedValue(targetUser);
      mockMoviesService.getProfileData.mockResolvedValue({});
      mockFriendRequestRepository.findOne.mockResolvedValueOnce(null);

      const result = await service.getPublicProfile(1, 99);

      expect(result.isFriend).toBe(false);
      expect(result.requestPending).toBe(false);
    });

    it('should return requestPending = true when a request was already sent', async () => {
      const targetUser = buildUser({ id: 1, friends: [] });
      mockUsersRepository.findOne.mockResolvedValue(targetUser);
      mockMoviesService.getProfileData.mockResolvedValue({});
      mockFriendRequestRepository.findOne.mockResolvedValueOnce({ id: 5 });

      const result = await service.getPublicProfile(1, 99);

      expect(result.isFriend).toBe(false);
      expect(result.requestPending).toBe(true);
    });

    it('should throw NotFoundException when target profile does not exist', async () => {
      mockUsersRepository.findOne.mockResolvedValue(null);

      await expect(service.getPublicProfile(999, 1)).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
