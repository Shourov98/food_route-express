import process from 'node:process';

export class LoggingPushNotificationService {
  async send(message) {
    process.stdout.write(
      `[push] token=${message.token} title=${message.title} body=${message.body}\n`,
    );
    return true;
  }

  async sendBulk({ tokens, title, body }) {
    const cleanTokens = [...new Set((tokens ?? []).filter(Boolean))];
    for (const token of cleanTokens) {
      process.stdout.write(`[push] token=${token} title=${title} body=${body}\n`);
    }
    return {
      success: cleanTokens.length > 0,
      targetCount: cleanTokens.length,
      sentCount: cleanTokens.length,
    };
  }
}

export class FirebasePushNotificationService {
  constructor({ messaging }) {
    this.messaging = messaging;
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
  }

  async send({ token, title, body, data }) {
    const result = await this.sendBulk({
      tokens: token ? [token] : [],
      title,
      body,
      data,
    });
    return result.sentCount > 0;
  }

  async sendBulk({ tokens, title, body, data, sendAfter = null }) {
    const cleanTokens = [...new Set((tokens ?? []).filter(Boolean))];
    if (cleanTokens.length === 0) {
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
          include_subscription_ids: cleanTokens,
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
          targetCount: cleanTokens.length,
          sentCount: 0,
        };
      }

      return {
        success: true,
        targetCount: cleanTokens.length,
        sentCount: cleanTokens.length,
      };
    } catch (error) {
      process.stderr.write(`[push] Failed to send OneSignal notification: ${error.message}\n`);
      return {
        success: false,
        targetCount: cleanTokens.length,
        sentCount: 0,
      };
    }
  }
}
