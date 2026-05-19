import path from 'node:path';
import { randomUUID } from 'node:crypto';

import { ApplicationError } from '../../core/ApplicationError.js';

function sanitizeFolder(folder) {
  return String(folder ?? '')
    .trim()
    .replaceAll('\\', '/')
    .replace(/^\/+|\/+$/g, '')
    .replaceAll('..', '') || 'uploads';
}

function validateUpload(file, { maxBytes }) {
  const contentType = String(file?.mimetype ?? '').trim().toLowerCase();
  if (!contentType.startsWith('image/')) {
    throw new ApplicationError({
      code: 'invalid_image_file',
      message: 'Uploaded file must be a valid image content type.',
      statusCode: 400,
    });
  }

  const buffer = file?.buffer;
  if (!buffer || buffer.length === 0) {
    throw new ApplicationError({
      code: 'empty_image_file',
      message: 'Uploaded image file is empty. Provide a non-empty image file or omit the field.',
      statusCode: 400,
    });
  }

  if (buffer.length > maxBytes) {
    throw new ApplicationError({
      code: 'image_too_large',
      message: `Uploaded image exceeds the maximum allowed size of ${maxBytes} bytes.`,
      statusCode: 400,
    });
  }

  return {
    buffer,
    contentType,
    originalName: path.basename(file.originalname || 'image'),
  };
}

export class FirebaseImageStorage {
  constructor({ storage, config }) {
    this.storage = storage;
    this.config = config;
  }

  async uploadImage({ folder, file }) {
    if (!this.config.firebaseStorageBucket) {
      throw new ApplicationError({
        code: 'storage_not_configured',
        message:
          "Image upload is not available because 'APP_FIREBASE_STORAGE_BUCKET' is not configured.",
        statusCode: 500,
      });
    }

    const { buffer, contentType, originalName } = validateUpload(file, {
      maxBytes: this.config.imageUploadMaxBytes,
    });

    const extension = path.extname(originalName).toLowerCase();
    const objectName = `${sanitizeFolder(folder)}/${randomUUID().replaceAll('-', '')}${extension}`;
    const downloadToken = randomUUID().replaceAll('-', '');
    const bucket = this.storage.bucket(this.config.firebaseStorageBucket);
    const bucketFile = bucket.file(objectName);

    await bucketFile.save(buffer, {
      contentType,
      metadata: {
        metadata: {
          firebaseStorageDownloadTokens: downloadToken,
        },
      },
    });

    const encodedName = encodeURIComponent(objectName);
    return {
      storagePath: objectName,
      publicUrl: `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodedName}?alt=media&token=${downloadToken}`,
      contentType,
      sizeBytes: buffer.length,
    };
  }
}
