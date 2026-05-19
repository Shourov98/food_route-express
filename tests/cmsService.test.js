import assert from 'node:assert/strict';
import test from 'node:test';

import { CmsService } from '../src/modules/cms/cmsService.js';

class FakePageRepository {
  constructor() {
    this.records = new Map();
  }

  async upsert(record) {
    this.records.set(record.slug, record);
    return record;
  }

  async create(record) {
    if (this.records.has(record.slug)) {
      throw new Error('exists');
    }
    this.records.set(record.slug, record);
    return record;
  }

  async getBySlug(slug) {
    return this.records.get(slug) ?? null;
  }

  async listAll() {
    return [...this.records.values()].sort(
      (left, right) => right.updatedAt.getTime() - left.updatedAt.getTime(),
    );
  }

  async delete(slug) {
    return this.records.delete(slug);
  }
}

class FakeUserRepository {
  constructor(user) {
    this.user = user;
  }

  async getByUid() {
    return this.user;
  }
}

class FakeIdentityProvider {
  async verifyIdToken() {
    return { uid: 'admin-1', email: 'admin@example.com' };
  }
}

function createService(user = { uid: 'admin-1', role: 'admin', isBlocked: false }) {
  const pageRepository = new FakePageRepository();
  const service = new CmsService({
    pageRepository,
    userRepository: new FakeUserRepository(user),
    identityProvider: new FakeIdentityProvider(),
  });
  return { service, pageRepository };
}

test('CmsService returns default public pages when no record exists', async () => {
  const { service } = createService();

  const result = await service.getAboutUs();

  assert.equal(result.slug, 'about-us');
  assert.equal(result.title, 'About Us');
  assert.equal(result.content, '');
});

test('CmsService admin upsert and public read share response shape', async () => {
  const { service } = createService();

  await service.upsertAboutUs({
    accessToken: 'token',
    payload: { title: 'About Food Route', content: '<p>Hello</p>' },
  });
  const result = await service.getAboutUs();

  assert.equal(result.title, 'About Food Route');
  assert.equal(result.content, '<p>Hello</p>');
  assert.ok(result.createdAt instanceof Date);
});

test('CmsService rejects non-admin CMS writes with FastAPI code', async () => {
  const { service } = createService({ uid: 'user-1', role: 'user', isBlocked: false });

  await assert.rejects(
    service.createPage({
      accessToken: 'token',
      payload: { slug: 'faq', title: 'FAQ', content: '' },
    }),
    { code: 'admin_not_found', statusCode: 403 },
  );
});
