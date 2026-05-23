import Busboy from 'busboy';

import { ApplicationError } from '../../core/ApplicationError.js';

function isMultipartRequest(req) {
  const contentType = String(req.headers['content-type'] ?? '').toLowerCase();
  return contentType.startsWith('multipart/form-data');
}

function isPlainObject(value) {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

export function multipartSingle(fieldName, { maxFileBytes = 5 * 1024 * 1024 } = {}) {
  return (req, res, next) => {
    if (!isMultipartRequest(req)) {
      next();
      return;
    }

    const busboy = Busboy({
      headers: req.headers,
      limits: {
        files: 1,
        fileSize: maxFileBytes,
      },
    });

    const body = {};
    let fileRecord = null;
    let fileTooLarge = false;
    let settled = false;

    const fail = (error) => {
      if (settled) return;
      settled = true;
      next(error);
    };

    const finish = () => {
      if (settled) return;
      settled = true;
      req.body = isPlainObject(req.body)
        ? { ...req.body, ...body }
        : body;
      req.file = fileRecord;
      next();
    };

    busboy.on('field', (name, value) => {
      body[name] = value;
    });

    busboy.on('file', (name, file, infoOrFilename, encodingArg, mimeTypeArg) => {
      const {
        filename,
        encoding,
        mimeType,
      } =
        typeof infoOrFilename === 'object' && infoOrFilename !== null
          ? {
              filename: infoOrFilename.filename,
              encoding: infoOrFilename.encoding,
              mimeType: infoOrFilename.mimeType,
            }
          : {
              filename: infoOrFilename,
              encoding: encodingArg,
              mimeType: mimeTypeArg,
            };
      const chunks = [];
      let sizeBytes = 0;

      file.on('data', (chunk) => {
        sizeBytes += chunk.length;
        chunks.push(chunk);
      });

      file.on('limit', () => {
        fileTooLarge = true;
      });

      file.on('end', () => {
        if (name !== fieldName) {
          return;
        }
        if (fileTooLarge) {
          return;
        }
        fileRecord = {
          fieldname: name,
          originalname: filename,
          encoding,
          mimetype: mimeType,
          size: sizeBytes,
          buffer: Buffer.concat(chunks),
        };
      });
    });

    busboy.on('filesLimit', () => {
      fail(
        new ApplicationError({
          code: 'invalid_multipart_form',
          message: 'Only one image file can be uploaded per request.',
          statusCode: 400,
        }),
      );
    });

    busboy.on('error', (error) => {
      fail(error);
    });

    busboy.on('close', () => {
      if (fileTooLarge) {
        fail(
          new ApplicationError({
            code: 'image_too_large',
            message: `Uploaded image exceeds the maximum allowed size of ${maxFileBytes} bytes.`,
            statusCode: 400,
          }),
        );
        return;
      }
      finish();
    });

    busboy.on('finish', () => {
      if (fileTooLarge || settled) {
        return;
      }
      finish();
    });

    if (req.rawBody && req.rawBody.length > 0) {
      busboy.end(req.rawBody);
      return;
    }

    req.pipe(busboy);
  };
}
