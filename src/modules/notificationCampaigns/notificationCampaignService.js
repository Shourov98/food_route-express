import { ApplicationError } from '../../core/ApplicationError.js';
import { getAuthenticatedAccount, requireActiveRoles } from '../../shared/auth/authorization.js';
import { buildPaginationMeta } from '../../shared/pagination.js';
import { buildNotificationCampaignRecordId } from './notificationCampaignRepository.js';

function normalizeDate(value) {
  if (!value) {
    return null;
  }
  if (!value.getTimezoneOffset) {
    return new Date(value);
  }
  return value;
}

function campaignResponse(record) {
  return {
    id: record.id,
    campaignTitle: record.campaignTitle,
    campaignBody: record.campaignBody,
    campaignCategory: record.campaignCategory,
    targetAudience: record.targetAudience,
    cityName: record.cityName,
    ageGroup: record.ageGroup,
    deliveryType: record.deliveryType,
    scheduledAt: record.scheduledAt,
    status: record.status,
    deliveryRate: record.deliveryRate,
    createdBy: record.createdBy,
    sentAt: record.sentAt,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

export class NotificationCampaignService {
  constructor({
    campaignRepository,
    userRepository,
    identityProvider,
    pushNotificationService = null,
  }) {
    this.campaignRepository = campaignRepository;
    this.userRepository = userRepository;
    this.identityProvider = identityProvider;
    this.pushNotificationService = pushNotificationService;
  }

  async createCampaign({ accessToken, payload }) {
    const admin = await this.getCurrentAdmin(accessToken);
    const now = new Date();
    const scheduledAt = normalizeDate(payload.scheduledAt);
    const status = this.resolveStatus({
      explicitStatus: payload.status,
      deliveryType: payload.deliveryType,
      scheduledAt,
      now,
    });
    this.validateSchedule({
      deliveryType: payload.deliveryType,
      campaignStatus: status,
      scheduledAt,
      now,
    });
    let record = {
      id: buildNotificationCampaignRecordId(),
      campaignTitle: payload.campaignTitle,
      campaignBody: payload.campaignBody,
      campaignCategory: payload.campaignCategory,
      targetAudience: payload.targetAudience,
      cityName: payload.cityName,
      ageGroup: payload.ageGroup,
      deliveryType: payload.deliveryType,
      scheduledAt,
      sentAt: payload.deliveryType === 'send_now' ? now : null,
      status,
      deliveryRate: payload.deliveryRate,
      createdBy: admin.uid,
      createdAt: now,
      updatedAt: now,
    };
    if (record.deliveryType === 'send_now') {
      record = await this.enrichWithDispatchMetrics(record);
    }
    return campaignResponse(await this.campaignRepository.create(record));
  }

  async updateCampaign({ accessToken, campaignId, payload }) {
    await this.getCurrentAdmin(accessToken);
    const existing = await this.getCampaignRecord(campaignId);
    const now = new Date();
    const scheduledAt = payload.hasScheduledAtField
      ? normalizeDate(payload.scheduledAt ?? null)
      : existing.scheduledAt;
    const deliveryType = payload.deliveryType ?? existing.deliveryType;
    const status = this.resolveStatus({
      explicitStatus: payload.status ?? existing.status,
      deliveryType,
      scheduledAt,
      now,
    });
    this.validateSchedule({
      deliveryType,
      campaignStatus: status,
      scheduledAt,
      now,
    });
    let updated = {
      ...existing,
      campaignTitle: payload.campaignTitle ?? existing.campaignTitle,
      campaignBody: payload.campaignBody ?? existing.campaignBody,
      campaignCategory: payload.campaignCategory ?? existing.campaignCategory,
      targetAudience: payload.targetAudience ?? existing.targetAudience,
      cityName: payload.cityName ?? existing.cityName,
      ageGroup: payload.ageGroup ?? existing.ageGroup,
      deliveryType,
      scheduledAt,
      sentAt: deliveryType === 'send_now' ? now : null,
      status,
      deliveryRate: payload.deliveryRate ?? existing.deliveryRate,
      updatedAt: now,
    };
    if (updated.deliveryType === 'send_now') {
      updated = await this.enrichWithDispatchMetrics(updated);
    }
    await this.campaignRepository.update(campaignId, updated);
    return campaignResponse(updated);
  }

  async deleteCampaign({ accessToken, campaignId }) {
    await this.getCurrentAdmin(accessToken);
    const deleted = await this.campaignRepository.delete(campaignId);
    if (!deleted) {
      throw new ApplicationError({
        code: 'notification_campaign_not_found',
        message: 'No notification campaign found for the provided identifier.',
        statusCode: 404,
      });
    }
  }

  async getCampaign({ accessToken, campaignId }) {
    await this.getCurrentAdmin(accessToken);
    return campaignResponse(await this.getCampaignRecord(campaignId));
  }

  async listCampaigns({
    accessToken,
    page,
    pageSize,
    search,
    statusFilter,
    campaignCategory,
    targetAudience,
    deliveryType,
    cityName,
    ageGroup,
    scheduledFrom,
    scheduledTo,
    minDeliveryRate,
    maxDeliveryRate,
    sortBy,
    sortOrder,
  }) {
    await this.getCurrentAdmin(accessToken);
    const now = new Date();
    let records = (await this.campaignRepository.listAll()).map((record) =>
      this.resolveRuntimeState(record, now),
    );
    if (search) {
      const needle = search.trim().toLowerCase();
      records = records.filter((record) =>
        record.campaignTitle.toLowerCase().includes(needle) ||
        record.campaignBody.toLowerCase().includes(needle) ||
        record.campaignCategory.toLowerCase().includes(needle),
      );
    }
    if (statusFilter) {
      records = records.filter((record) => record.status === statusFilter);
    }
    if (campaignCategory) {
      records = records.filter((record) => record.campaignCategory === campaignCategory);
    }
    if (targetAudience) {
      records = records.filter((record) => record.targetAudience === targetAudience);
    }
    if (deliveryType) {
      records = records.filter((record) => record.deliveryType === deliveryType);
    }
    if (cityName) {
      const cityNeedle = cityName.trim().toLowerCase();
      records = records.filter((record) => (record.cityName ?? '').toLowerCase() === cityNeedle);
    }
    if (ageGroup) {
      const ageNeedle = ageGroup.trim().toLowerCase();
      records = records.filter((record) => (record.ageGroup ?? '').toLowerCase() === ageNeedle);
    }
    if (scheduledFrom) {
      records = records.filter((record) => record.scheduledAt && record.scheduledAt >= scheduledFrom);
    }
    if (scheduledTo) {
      records = records.filter((record) => record.scheduledAt && record.scheduledAt <= scheduledTo);
    }
    if (minDeliveryRate !== null) {
      records = records.filter((record) => record.deliveryRate >= minDeliveryRate);
    }
    if (maxDeliveryRate !== null) {
      records = records.filter((record) => record.deliveryRate <= maxDeliveryRate);
    }

    records = this.sortRecords(records, { sortBy, sortOrder });
    const totalItems = records.length;
    const start = (page - 1) * pageSize;
    return {
      items: records.slice(start, start + pageSize).map(campaignResponse),
      pagination: buildPaginationMeta({ page, pageSize, totalItems }),
    };
  }

  async getCampaignRecord(campaignId) {
    const record = await this.campaignRepository.getById(campaignId);
    if (!record) {
      throw new ApplicationError({
        code: 'notification_campaign_not_found',
        message: 'No notification campaign found for the provided identifier.',
        statusCode: 404,
      });
    }
    return this.resolveRuntimeState(record, new Date());
  }

  async getCurrentAdmin(accessToken) {
    const record = await getAuthenticatedAccount({
      accessToken,
      identityProvider: this.identityProvider,
      userRepository: this.userRepository,
      notFoundCode: 'admin_not_found',
      notFoundMessage: 'No admin account found for the provided credentials.',
      notFoundStatusCode: 403,
    });
    return requireActiveRoles({
      record,
      allowedRoles: new Set(['admin', 'super_admin']),
      roleErrorCode: 'admin_not_found',
      roleErrorMessage: 'No admin account found for the provided credentials.',
      blockedErrorCode: 'admin_blocked',
      blockedErrorMessage: 'The admin account is blocked.',
    });
  }

  validateSchedule({ deliveryType, campaignStatus, scheduledAt, now }) {
    if (deliveryType === 'send_now' && scheduledAt !== null) {
      throw new ApplicationError({
        code: 'invalid_campaign_schedule',
        message: "Field 'scheduledAt' must be omitted when deliveryType is 'send_now'.",
        statusCode: 400,
      });
    }
    if (deliveryType === 'schedule_later' && scheduledAt === null) {
      throw new ApplicationError({
        code: 'invalid_campaign_schedule',
        message: "Field 'scheduledAt' is required when deliveryType is 'schedule_later'.",
        statusCode: 400,
      });
    }
    if (scheduledAt && deliveryType === 'schedule_later' && scheduledAt <= now) {
      throw new ApplicationError({
        code: 'invalid_campaign_schedule',
        message: "Scheduled campaigns must use a future 'scheduledAt' timestamp.",
        statusCode: 400,
      });
    }
    if (campaignStatus === 'draft') {
      throw new ApplicationError({
        code: 'invalid_campaign_status',
        message: 'Campaigns cannot be created or updated in draft status.',
        statusCode: 400,
      });
    }
  }

  resolveStatus({ explicitStatus, deliveryType, scheduledAt, now }) {
    const derivedStatus = deliveryType === 'send_now' ? 'active' : 'scheduled';
    if (!explicitStatus) {
      return derivedStatus;
    }
    if (explicitStatus === 'completed') {
      return explicitStatus;
    }
    if (explicitStatus !== derivedStatus) {
      throw new ApplicationError({
        code: 'invalid_campaign_status',
        message: 'The provided campaign status does not match the delivery type.',
        statusCode: 400,
      });
    }
    if (deliveryType === 'schedule_later' && scheduledAt && scheduledAt <= now) {
      return 'active';
    }
    return explicitStatus;
  }

  resolveRuntimeState(record, now) {
    if (
      record.deliveryType === 'schedule_later' &&
      record.status === 'scheduled' &&
      record.scheduledAt &&
      record.scheduledAt <= now
    ) {
      return {
        ...record,
        status: 'active',
      };
    }
    return record;
  }

  async enrichWithDispatchMetrics(record) {
    const dispatch = await this.dispatchCampaign(record);
    return {
      ...record,
      deliveryRate:
        dispatch.targetCount > 0 ? Number(((dispatch.sentCount / dispatch.targetCount) * 100).toFixed(2)) : 0,
    };
  }

  async dispatchCampaign(record) {
    if (!this.pushNotificationService) {
      return { targetCount: 0, sentCount: 0 };
    }

    const recipients = await this.resolveCampaignRecipients(record);
    const tokens = [...new Set(recipients.map((user) => user.pushNotificationToken).filter(Boolean))];
    if (tokens.length === 0) {
      return { targetCount: 0, sentCount: 0 };
    }

    if (typeof this.pushNotificationService.sendBulk === 'function') {
      const result = await this.pushNotificationService.sendBulk({
        tokens,
        title: record.campaignTitle,
        body: record.campaignBody,
        data: {
          type: 'campaign',
          campaignId: record.id,
          campaignCategory: record.campaignCategory,
          targetAudience: record.targetAudience,
        },
      });
      return {
        targetCount: result.targetCount ?? tokens.length,
        sentCount: result.sentCount ?? 0,
      };
    }

    let sentCount = 0;
    for (const token of tokens) {
      const delivered = await this.pushNotificationService.send({
        token,
        title: record.campaignTitle,
        body: record.campaignBody,
        data: {
          type: 'campaign',
          campaignId: record.id,
          campaignCategory: record.campaignCategory,
          targetAudience: record.targetAudience,
        },
      });
      if (delivered) {
        sentCount += 1;
      }
    }

    return {
      targetCount: tokens.length,
      sentCount,
    };
  }

  async resolveCampaignRecipients(record) {
    const users = (await this.userRepository.listByRole('user')).filter(
      (user) => user.isVerified && !user.isBlocked && user.pushNotificationToken,
    );

    switch (record.targetAudience) {
      case 'city': {
        const needle = (record.cityName ?? '').trim().toLowerCase();
        return users.filter((user) => (user.city ?? '').trim().toLowerCase() === needle);
      }
      case 'age_group':
        return users.filter((user) => this.matchesAgeGroup(user.age, record.ageGroup));
      case 'new_user': {
        const threshold = Date.now() - 30 * 24 * 60 * 60 * 1000;
        return users.filter((user) => user.createdAt.getTime() >= threshold);
      }
      case 'all_users':
      case 'global':
        return users;
      default:
        return [];
    }
  }

  matchesAgeGroup(age, ageGroup) {
    if (age === null || age === undefined || !ageGroup) {
      return false;
    }

    const normalized = String(ageGroup).trim();
    const rangeMatch = normalized.match(/^(\d+)\s*-\s*(\d+)$/);
    if (rangeMatch) {
      return age >= Number(rangeMatch[1]) && age <= Number(rangeMatch[2]);
    }

    const plusMatch = normalized.match(/^(\d+)\+$/);
    if (plusMatch) {
      return age >= Number(plusMatch[1]);
    }

    const exactValue = Number(normalized);
    return !Number.isNaN(exactValue) && age === exactValue;
  }

  sortRecords(records, { sortBy, sortOrder }) {
    const reverse = sortOrder === 'desc' ? -1 : 1;
    return [...records].sort((left, right) => {
      let leftValue;
      let rightValue;
      switch (sortBy) {
        case 'campaignTitle':
          leftValue = left.campaignTitle.toLowerCase();
          rightValue = right.campaignTitle.toLowerCase();
          break;
        case 'scheduledAt':
          leftValue = left.scheduledAt?.getTime() ?? Number.MAX_SAFE_INTEGER;
          rightValue = right.scheduledAt?.getTime() ?? Number.MAX_SAFE_INTEGER;
          break;
        case 'deliveryRate':
          leftValue = left.deliveryRate;
          rightValue = right.deliveryRate;
          break;
        case 'campaignCategory':
          leftValue = left.campaignCategory;
          rightValue = right.campaignCategory;
          break;
        case 'deliveryType':
          leftValue = left.deliveryType;
          rightValue = right.deliveryType;
          break;
        case 'updatedAt':
          leftValue = left.updatedAt.getTime();
          rightValue = right.updatedAt.getTime();
          break;
        default:
          leftValue = left.createdAt.getTime();
          rightValue = right.createdAt.getTime();
          break;
      }
      if (leftValue < rightValue) return -1 * reverse;
      if (leftValue > rightValue) return 1 * reverse;
      return (left.id < right.id ? -1 : 1) * reverse;
    });
  }
}
