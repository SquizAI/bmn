import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock config
vi.mock('../config/index.js', () => ({
  config: {
    RESEND_API_KEY: 'test-resend-key',
    FROM_EMAIL: 'Brand Me Now <hello@brandmenow.com>',
    SUPPORT_EMAIL: 'support@brandmenow.com',
  },
}));

vi.mock('../lib/logger.js', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
    child: vi.fn().mockReturnValue({
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn(),
    }),
  },
}));

// Mock resend module
const mockSend = vi.fn();
vi.mock('resend', () => ({
  Resend: vi.fn().mockImplementation(() => ({
    emails: {
      send: mockSend,
    },
  })),
}));

describe('Email Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('escapeHtml', () => {
    it('should escape HTML special characters', async () => {
      const { escapeHtml } = await import('../services/email.js');

      expect(escapeHtml('<script>alert("xss")</script>')).toBe(
        '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;'
      );
    });

    it('should escape ampersands', async () => {
      const { escapeHtml } = await import('../services/email.js');

      expect(escapeHtml('Tom & Jerry')).toBe('Tom &amp; Jerry');
    });

    it('should escape single quotes', async () => {
      const { escapeHtml } = await import('../services/email.js');

      expect(escapeHtml("it's")).toBe('it&#39;s');
    });

    it('should return empty string for falsy input', async () => {
      const { escapeHtml } = await import('../services/email.js');

      expect(escapeHtml('')).toBe('');
      expect(escapeHtml(null)).toBe('');
      expect(escapeHtml(undefined)).toBe('');
    });

    it('should handle strings with no special characters', async () => {
      const { escapeHtml } = await import('../services/email.js');

      expect(escapeHtml('Hello World')).toBe('Hello World');
    });

    it('should handle numeric values by converting to string', async () => {
      const { escapeHtml } = await import('../services/email.js');

      expect(escapeHtml(42)).toBe('42');
    });
  });

  describe('sendEmail', () => {
    it('should send an email via Resend', async () => {
      mockSend.mockResolvedValueOnce({
        data: { id: 'msg-123' },
        error: null,
      });

      const { sendEmail } = await import('../services/email.js');
      const result = await sendEmail({
        to: 'user@example.com',
        subject: 'Welcome to Brand Me Now',
        html: '<h1>Welcome!</h1>',
      });

      expect(result).toEqual({ id: 'msg-123' });
      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'user@example.com',
          subject: 'Welcome to Brand Me Now',
          html: '<h1>Welcome!</h1>',
        })
      );
    });

    it('should use default from and reply-to addresses', async () => {
      mockSend.mockResolvedValueOnce({
        data: { id: 'msg-456' },
        error: null,
      });

      const { sendEmail } = await import('../services/email.js');
      await sendEmail({
        to: 'user@example.com',
        subject: 'Test',
        html: '<p>Test</p>',
      });

      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          from: 'Brand Me Now <hello@brandmenow.com>',
          reply_to: 'support@brandmenow.com',
        })
      );
    });

    it('should pass custom from and replyTo when provided', async () => {
      mockSend.mockResolvedValueOnce({
        data: { id: 'msg-789' },
        error: null,
      });

      const { sendEmail } = await import('../services/email.js');
      await sendEmail({
        to: 'user@example.com',
        subject: 'Custom sender',
        html: '<p>Hello</p>',
        from: 'Custom <custom@brandmenow.com>',
        replyTo: 'custom-reply@brandmenow.com',
      });

      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          from: 'Custom <custom@brandmenow.com>',
          reply_to: 'custom-reply@brandmenow.com',
        })
      );
    });

    it('should include Resend tag when provided', async () => {
      mockSend.mockResolvedValueOnce({
        data: { id: 'msg-tag' },
        error: null,
      });

      const { sendEmail } = await import('../services/email.js');
      await sendEmail({
        to: 'user@example.com',
        subject: 'Tagged',
        html: '<p>Tagged</p>',
        tag: 'welcome',
      });

      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          tags: [{ name: 'category', value: 'welcome' }],
        })
      );
    });

    it('should not include tags when tag is not provided', async () => {
      mockSend.mockResolvedValueOnce({
        data: { id: 'msg-notag' },
        error: null,
      });

      const { sendEmail } = await import('../services/email.js');
      await sendEmail({
        to: 'user@example.com',
        subject: 'No tag',
        html: '<p>No tag</p>',
      });

      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          tags: undefined,
        })
      );
    });

    it('should throw on Resend API error', async () => {
      mockSend.mockResolvedValueOnce({
        data: null,
        error: { message: 'Invalid API key' },
      });

      const { sendEmail } = await import('../services/email.js');

      await expect(
        sendEmail({
          to: 'user@example.com',
          subject: 'Will fail',
          html: '<p>Fail</p>',
        })
      ).rejects.toThrow('Resend error: Invalid API key');
    });
  });
});
