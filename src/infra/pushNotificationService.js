import process from 'node:process';

export class LoggingPushNotificationService {
  constructor() {
    this.targetingMode = 'token';
  }

  async send(message) {
    const target = message.recipientId ? `recipientId=${message.recipientId}` : `token=${message.token}`;
    process.stdout.write(`[push] ${target} title=${message.title} body=${message.body}\n`);
    return true;
  }

  async sendBulk({ tokens, recipientIds, title, body }) {
    const mode = recipientIds?.length ? 'external_id' : 'token';
    const targets = [...new Set(((mode === 'external_id' ? recipientIds : tokens) ?? []).filter(Boolean))];
    for (const target of targets) {
      const label = mode === 'external_id' ? `recipientId=${target}` : `token=${target}`;
      process.stdout.write(`[push] ${label} title=${title} body=${body}\n`);
    }
    return {
      success: targets.length > 0,
      targetCount: targets.length,
      sentCount: targets.length,
    };
  }
}

export class FirebasePushNotificationService {
  constructor({ messaging }) {
    this.messaging = messaging;
    this.targetingMode = 'token';
  }

  async send({ token, title, body, data }) {
    try {
      await this.messaging.send({
        token,
        notification: { title, body },
        data: data || undefined,
      });
      return true;
    } catch (error) {
      process.stderr.write(`[push] Failed to send push notification: ${error.message}\n`);
      return false;
    }
  }

  async sendBulk({ tokens, title, body, data }) {
    const cleanTokens = [...new Set((tokens ?? []).filter(Boolean))];
    let sentCount = 0;

    for (const token of cleanTokens) {
      const delivered = await this.send({ token, title, body, data });
      if (delivered) {
        sentCount += 1;
      }
    }

    return {
      success: sentCount > 0,
      targetCount: cleanTokens.length,
      sentCount,
    };
  }
}

export class OneSignalPushNotificationService {
  constructor({ appId, apiKey, apiUrl }) {
    this.appId = appId;
    this.apiKey = apiKey;
    this.apiUrl = apiUrl;
    this.targetingMode = 'external_id';
  }

  async send({ token, recipientId, title, body, data }) {
    const result = await this.sendBulk({
      tokens: token ? [token] : [],
      recipientIds: recipientId ? [recipientId] : [],
      title,
      body,
      data,
    });
    return result.sentCount > 0;
  }

  async sendBulk({ tokens, recipientIds, title, body, data, sendAfter = null }) {
    const cleanTokens = [...new Set((tokens ?? []).filter(Boolean))];
    const cleanRecipientIds = [...new Set((recipientIds ?? []).filter(Boolean))];
    const useRecipientIds = cleanRecipientIds.length > 0;
    const targetCount = useRecipientIds ? cleanRecipientIds.length : cleanTokens.length;

    if (targetCount === 0) {
      return {
        success: false,
        targetCount: 0,
        sentCount: 0,
      };
    }

    try {
      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          Authorization: `key ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          app_id: this.appId,
          target_channel: 'push',
          include_aliases: useRecipientIds ? { external_id: cleanRecipientIds } : undefined,
          include_subscription_ids: useRecipientIds ? undefined : cleanTokens,
          headings: { en: title },
          contents: { en: body },
          data: data || undefined,
          send_after: sendAfter ? new Date(sendAfter).toUTCString() : undefined,
        }),
      });

      if (!response.ok) {
        const detail = await response.text();
        process.stderr.write(
          `[push] Failed to send OneSignal notification: ${response.status} ${detail}\n`,
        );
        return {
          success: false,
          targetCount,
          sentCount: 0,
        };
      }

      return {
        success: true,
        targetCount,
        sentCount: targetCount,
      };
    } catch (error) {
      process.stderr.write(`[push] Failed to send OneSignal notification: ${error.message}\n`);
      return {
        success: false,
        targetCount,
        sentCount: 0,
      };
    }
  }
}
