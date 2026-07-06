import { env } from './env.js';
import { logger } from './logger.js';

interface NtfyPublishOptions {
  /** The topic/channel to publish to (maps to a user's ntfyTopic) */
  topic: string;
  /** Notification title */
  title: string;
  /** Notification body/message */
  message: string;
  /** Priority: 1=min, 3=default, 5=max (triggers alert on mobile) */
  priority?: 1 | 2 | 3 | 4 | 5;
  /** Click action URL (e.g. deep link into app) */
  click?: string;
  /** Custom tags/emojis as comma-separated string */
  tags?: string;
  /** Custom headers for the ntfy request */
  headers?: Record<string, string>;
}

/**
 * Publish a push notification to a user's ntfy topic.
 *
 * Uses the public ntfy.sh server by default, or a self-hosted instance
 * when NTFY_SELF_HOSTED=true and NTFY_BASE_URL is configured.
 */
export async function publishToNtfy(options: NtfyPublishOptions): Promise<boolean> {
  const { topic, title, message, priority = 3, click, tags, headers: extraHeaders = {} } = options;

  const url = `${env.NTFY_BASE_URL}/${topic}`;

  const body: Record<string, unknown> = {
    topic,
    title,
    message,
    priority,
  };

  if (click) body.click = click;
  if (tags) body.tags = tags;
  if (extraHeaders) body.headers = extraHeaders;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      logger.warn(
        { status: response.status, topic, title },
        'ntfy.sh publish returned non-2xx status',
      );
      return false;
    }

    logger.info({ topic, title }, 'ntfy.sh notification published successfully');
    return true;
  } catch (error) {
    logger.error({ err: error, topic, title }, 'Failed to publish ntfy.sh notification');
    return false;
  }
}

/**
 * Build a click URL for deep-linking into the mobile app or web admin panel.
 * @param path - The relative path to navigate to (e.g., '/complaints/123')
 */
export function buildClickUrl(path: string): string {
  return `${env.FRONTEND_URL}${path}`;
}
