import { ApplicationError } from '../../core/ApplicationError.js';
import { buildPaginationMeta } from '../../shared/pagination.js';
import { getAuthenticatedAccount, requireActiveRoles } from '../../shared/auth/authorization.js';

function normalizeSlug(slug) {
  const normalized = slug.trim().toLowerCase();
  if (normalized === 'terms-of-service') {
    return 'terms-and-conditions';
  }
  return normalized;
}

function defaultTitleForSlug(slug) {
  if (slug === 'about-us') {
    return 'About Us';
  }
  if (slug === 'privacy-policy') {
    return 'Privacy Policy';
  }
  return 'Terms & Conditions';
}

function pageData(record) {
  return {
    slug: record.slug,
    title: record.title,
    content: record.content,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

export class CmsService {
  constructor({ pageRepository, userRepository, identityProvider }) {
    this.pageRepository = pageRepository;
    this.userRepository = userRepository;
    this.identityProvider = identityProvider;
  }

  async getAboutUs() {
    return this.getPublicPage('about-us', 'About Us');
  }

  async upsertAboutUs({ accessToken, payload }) {
    return this.upsertAdminPage({ accessToken, slug: 'about-us', defaultTitle: 'About Us', payload });
  }

  async getPrivacyPolicy() {
    return this.getPublicPage('privacy-policy', 'Privacy Policy');
  }

  async upsertPrivacyPolicy({ accessToken, payload }) {
    return this.upsertAdminPage({
      accessToken,
      slug: 'privacy-policy',
      defaultTitle: 'Privacy Policy',
      payload,
    });
  }

  async getTermsAndConditions() {
    return this.getPublicPage('terms-and-conditions', 'Terms & Conditions');
  }

  async upsertTermsAndConditions({ accessToken, payload }) {
    return this.upsertAdminPage({
      accessToken,
      slug: 'terms-and-conditions',
      defaultTitle: 'Terms & Conditions',
      payload,
    });
  }

  async getPageBySlug(slug) {
    const normalizedSlug = normalizeSlug(slug);
    return this.getPublicPage(normalizedSlug, defaultTitleForSlug(normalizedSlug));
  }

  async listPages({ accessToken, page, pageSize, search }) {
    await this.getCurrentAdmin(accessToken);
    let records = await this.pageRepository.listAll();
    if (search) {
      const needle = search.trim().toLowerCase();
      records = records.filter(
        (record) =>
          record.slug.toLowerCase().includes(needle) ||
          record.title.toLowerCase().includes(needle) ||
          record.content.toLowerCase().includes(needle),
      );
    }
    const totalItems = records.length;
    const start = (page - 1) * pageSize;
    return {
      items: records.slice(start, start + pageSize).map(pageData),
      pagination: buildPaginationMeta({ page, pageSize, totalItems }),
    };
  }

  async createPage({ accessToken, payload }) {
    await this.getCurrentAdmin(accessToken);
    const slug = normalizeSlug(payload.slug);
    if (await this.pageRepository.getBySlug(slug)) {
      throw new ApplicationError({
        code: 'cms_page_already_exists',
        message: 'A CMS page with this slug already exists.',
        statusCode: 409,
      });
    }
    const now = new Date();
    const record = {
      slug,
      title: payload.title,
      content: payload.content,
      createdAt: now,
      updatedAt: now,
    };
    await this.pageRepository.create(record);
    return pageData(record);
  }

  async updatePage({ accessToken, slug, payload }) {
    await this.getCurrentAdmin(accessToken);
    const normalizedSlug = normalizeSlug(slug);
    const existing = await this.pageRepository.getBySlug(normalizedSlug);
    if (!existing) {
      throw new ApplicationError({
        code: 'cms_page_not_found',
        message: 'No CMS page found for the provided slug.',
        statusCode: 404,
      });
    }
    const updated = {
      slug: existing.slug,
      title: payload.title ?? existing.title,
      content: payload.content ?? existing.content,
      createdAt: existing.createdAt,
      updatedAt: new Date(),
    };
    await this.pageRepository.upsert(updated);
    return pageData(updated);
  }

  async deletePage({ accessToken, slug }) {
    await this.getCurrentAdmin(accessToken);
    const deleted = await this.pageRepository.delete(normalizeSlug(slug));
    if (!deleted) {
      throw new ApplicationError({
        code: 'cms_page_not_found',
        message: 'No CMS page found for the provided slug.',
        statusCode: 404,
      });
    }
  }

  async upsertAdminPage({ accessToken, slug, defaultTitle, payload }) {
    await this.getCurrentAdmin(accessToken);
    const normalizedSlug = normalizeSlug(slug);
    const now = new Date();
    const existing = await this.pageRepository.getBySlug(normalizedSlug);
    const record = {
      slug: normalizedSlug,
      title: payload.title ?? existing?.title ?? defaultTitle,
      content: payload.content,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
    await this.pageRepository.upsert(record);
    return pageData(record);
  }

  async getPublicPage(slug, defaultTitle) {
    const normalizedSlug = normalizeSlug(slug);
    const existing = await this.pageRepository.getBySlug(normalizedSlug);
    if (existing) {
      return pageData(existing);
    }
    const now = new Date();
    return pageData({
      slug: normalizedSlug,
      title: defaultTitle,
      content: '',
      createdAt: now,
      updatedAt: now,
    });
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
}
