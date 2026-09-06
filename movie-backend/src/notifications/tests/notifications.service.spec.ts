import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotificationsService } from '../notifications.service';
import { Notification } from '../notification.entity';
import { PushService } from '../../push/push.service';
import { Logger, NotFoundException } from '@nestjs/common';

const mockNotificationRepo = {
  find: jest.fn(),
  findOne: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
};

const mockPushService = {
  sendToUser: jest.fn(),
};

describe('NotificationsService', () => {
  let service: NotificationsService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsService,
        {
          provide: getRepositoryToken(Notification),
          useValue: mockNotificationRepo,
        },
        {
          provide: PushService,
          useValue: mockPushService,
        },
      ],
    }).compile();

    service = module.get<NotificationsService>(NotificationsService);
  });

  describe('notify', () => {
    it('saves a notification via notificationRepo.create/save with the given fields', async () => {
      const input = {
        type: 'release',
        title: 'New release',
        body: 'Movie x is out',
        tmdbId: 123,
        posterUrl: 'poster.jpg',
        mediaType: 'movie',
        url: '/movies/123',
      };
      mockNotificationRepo.create.mockReturnValueOnce([]);
      mockPushService.sendToUser.mockResolvedValueOnce(undefined);

      await service.notify(1, input);

      expect(mockNotificationRepo.create).toHaveBeenCalledWith({
        type: 'release',
        title: 'New release',
        body: 'Movie x is out',
        tmdbId: 123,
        posterUrl: 'poster.jpg',
        mediaType: 'movie',
        url: '/movies/123',
        user: { id: 1 },
      });
    });
    it('sends a push using pushTitle/pushBody when provided', async () => {
      const input = {
        type: 'release',
        title: 'New release',
        body: 'Movie x is out',
        tmdbId: 123,
        posterUrl: 'poster.jpg',
        mediaType: 'movie',
        url: '/movies/123',
        pushTitle: 'Push title',
        pushBody: 'Push body',
      };
      mockNotificationRepo.create.mockReturnValueOnce([]);
      mockPushService.sendToUser.mockResolvedValueOnce();

      await service.notify(1, input);

      expect(mockPushService.sendToUser).toHaveBeenCalledWith(1, {
        title: 'Push title',
        body: 'Push body',
        url: '/movies/123',
      });
    });
    it('falls back to title/body for the push payload when pushTitle/pushBody are missing', async () => {
      const input = {
        type: 'release',
        title: 'New release',
        body: 'Movie x is out',
        tmdbId: 123,
        posterUrl: 'poster.jpg',
        mediaType: 'movie',
        url: '/movies/123',
      };
      mockNotificationRepo.create.mockReturnValueOnce([]);
      mockPushService.sendToUser.mockResolvedValueOnce();

      await service.notify(1, input);

      expect(mockPushService.sendToUser).toHaveBeenCalledWith(1, {
        title: 'New release',
        body: 'Movie x is out',
        url: '/movies/123',
      });
    });
    it('does not throw when pushService.sendToUser() rejects (push failure is swallowed)', async () => {
      const input = {
        type: 'release',
        title: 'New release',
        body: 'Movie x is out',
        tmdbId: 123,
        posterUrl: 'poster.jpg',
        mediaType: 'movie',
        url: '/movies/123',
      };
      mockNotificationRepo.create.mockReturnValueOnce([]);
      mockPushService.sendToUser.mockRejectedValueOnce(
        new Error('push failed'),
      );

      await service.notify(1, input);

      expect(mockPushService.sendToUser).toHaveBeenCalledWith(1, {
        title: 'New release',
        body: 'Movie x is out',
        url: '/movies/123',
      });
    });
  });

  describe('getNotifications', () => {
    it('queries notificationRepo.find with the user filter, DESC order and default limit/offset', async () => {
      mockNotificationRepo.find.mockResolvedValueOnce([
        'New release',
        'New quiz',
      ]);

      await service.getNotifications(1);

      expect(mockNotificationRepo.find).toHaveBeenCalledWith({
        where: { user: { id: 1 } },
        order: { createdAt: 'DESC' },
        take: 30,
        skip: 0,
      });
    });
    it('passes a custom limit and offset through to the repo query', async () => {
      mockNotificationRepo.find.mockResolvedValueOnce([
        'New release',
        'New quiz',
      ]);

      await service.getNotifications(1, 40, 3);

      expect(mockNotificationRepo.find).toHaveBeenCalledWith({
        where: { user: { id: 1 } },
        order: { createdAt: 'DESC' },
        take: 40,
        skip: 3,
      });
    });
  });

  describe('markNotificationRead', () => {
    it('sets isRead = true and saves it, returning a success message', async () => {
      mockNotificationRepo.findOne.mockResolvedValueOnce({ isRead: false });

      const result = await service.markNotificationRead(1, 1);

      expect(mockNotificationRepo.save).toHaveBeenCalledWith({ isRead: true });
      expect(result).toEqual({ message: 'Notification marked as read' });
    });
    it('throws NotFoundException when no matching notification is found', async () => {
      mockNotificationRepo.findOne.mockResolvedValueOnce(null);

      await expect(service.markNotificationRead(1, 1)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('markAllNotificationsRead', () => {
    it('calls notificationRepo.update with the unread filter and isRead: true patch', async () => {
      mockNotificationRepo.update.mockResolvedValueOnce(undefined);
      await service.markAllNotificationsRead(1);

      expect(mockNotificationRepo.update).toHaveBeenCalledWith(
        { user: { id: 1 }, isRead: false },
        { isRead: true },
      );
    });
  });

  describe('deleteOldNotifications', () => {
    it('deletes notifications older than 30 days via notificationRepo.delete(LessThan(cutoff))', async () => {
      mockNotificationRepo.delete.mockResolvedValueOnce({ affected: 5 });

      await service.deleteOldNotifications();

      expect(mockNotificationRepo.delete).toHaveBeenCalledWith(
        expect.objectContaining({ createdAt: expect.anything() }),
      );
    });
    it('logs a message only when result.affected is truthy', async () => {
      const logSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation();
      mockNotificationRepo.delete.mockResolvedValueOnce({ affected: 5 });

      await service.deleteOldNotifications();
      expect(logSpy).toHaveBeenCalled();
      logSpy.mockClear();

      mockNotificationRepo.delete.mockResolvedValueOnce({ affected: 0 });

      await service.deleteOldNotifications();
      expect(logSpy).not.toHaveBeenCalled();
      logSpy.mockClear();
    });
  });
});
