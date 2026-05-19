import zlib from 'node:zlib';

import { ApplicationError } from '../../core/ApplicationError.js';

const QUIET_ZONE = 4;

export function buildQrPayload(payload) {
  return JSON.stringify(payload);
}

export function parseQrPayload(payload) {
  try {
    const parsed = JSON.parse(payload);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

async function buildQrMatrix(payload) {
  let QRCode;
  try {
    QRCode = await import('qrcode');
  } catch {
    throw new ApplicationError({
      code: 'qr_export_unavailable',
      message: 'QR export is unavailable because the QR code dependency is not installed.',
      statusCode: 500,
    });
  }

  const qr = QRCode.create(payload, { errorCorrectionLevel: 'L' });
  const size = qr.modules.size;
  const data = qr.modules.data;
  const matrix = [];
  for (let row = 0; row < size; row += 1) {
    const line = [];
    for (let col = 0; col < size; col += 1) {
      line.push(Boolean(data[row * size + col]));
    }
    matrix.push(line);
  }
  return matrix;
}

function pngPack(chunkType, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(zlib.crc32(Buffer.concat([chunkType, data])) >>> 0, 0);
  return Buffer.concat([length, chunkType, data, crc]);
}

function renderPngBytes(matrix) {
  const moduleSize = 10;
  const width = (matrix.length + QUIET_ZONE * 2) * moduleSize;
  const pixels = [];

  for (let y = 0; y < width; y += 1) {
    pixels.push(0);
    const matrixY = Math.floor(y / moduleSize) - QUIET_ZONE;
    for (let x = 0; x < width; x += 1) {
      const matrixX = Math.floor(x / moduleSize) - QUIET_ZONE;
      const isDark =
        matrixX >= 0 &&
        matrixX < matrix.length &&
        matrixY >= 0 &&
        matrixY < matrix.length &&
        matrix[matrixY][matrixX];
      const value = isDark ? 0 : 255;
      pixels.push(value, value, value);
    }
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(width, 4);
  ihdr.writeUInt8(8, 8);
  ihdr.writeUInt8(2, 9);
  ihdr.writeUInt8(0, 10);
  ihdr.writeUInt8(0, 11);
  ihdr.writeUInt8(0, 12);

  return Buffer.concat([
    Buffer.from('\x89PNG\r\n\x1a\n', 'binary'),
    pngPack(Buffer.from('IHDR'), ihdr),
    pngPack(Buffer.from('IDAT'), zlib.deflateSync(Buffer.from(pixels), { level: 9 })),
    pngPack(Buffer.from('IEND'), Buffer.alloc(0)),
  ]);
}

function renderPdfBytes(matrix, title) {
  const moduleSize = 4;
  const quiet = QUIET_ZONE * moduleSize;
  const qrSize = matrix.length * moduleSize;
  const pageWidth = quiet * 2 + qrSize + 72;
  const pageHeight = pageWidth + 56;
  const left = 36;
  const bottom = 48;
  const commands = ['0 0 0 rg'];

  for (let row = 0; row < matrix.length; row += 1) {
    for (let col = 0; col < matrix[row].length; col += 1) {
      if (!matrix[row][col]) {
        continue;
      }
      const x = left + (col + QUIET_ZONE) * moduleSize;
      const y = bottom + (matrix.length - 1 - row + QUIET_ZONE) * moduleSize;
      commands.push(`${x} ${y} ${moduleSize} ${moduleSize} re f`);
    }
  }
  const escapedTitle = String(title)
    .slice(0, 60)
    .replaceAll('\\', '\\\\')
    .replaceAll('(', '\\(')
    .replaceAll(')', '\\)');
  commands.push('BT /F1 18 Tf 1 0 0 1 36 28 Tm');
  commands.push(`(${escapedTitle}) Tj ET`);
  const stream = Buffer.from(commands.join('\n'), 'latin1');
  const objects = [
    Buffer.from('<< /Type /Catalog /Pages 2 0 R >>', 'ascii'),
    Buffer.from('<< /Type /Pages /Kids [3 0 R] /Count 1 >>', 'ascii'),
    Buffer.from(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>`,
      'ascii',
    ),
    Buffer.from('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>', 'ascii'),
    Buffer.concat([
      Buffer.from(`<< /Length ${stream.length} >>\nstream\n`, 'ascii'),
      stream,
      Buffer.from('\nendstream', 'ascii'),
    ]),
  ];

  const chunks = [Buffer.from('%PDF-1.4\n', 'ascii')];
  const offsets = [0];
  let offset = chunks[0].length;
  for (let index = 0; index < objects.length; index += 1) {
    offsets.push(offset);
    const object = Buffer.concat([
      Buffer.from(`${index + 1} 0 obj\n`, 'ascii'),
      objects[index],
      Buffer.from('\nendobj\n', 'ascii'),
    ]);
    chunks.push(object);
    offset += object.length;
  }

  const xrefStart = offset;
  chunks.push(Buffer.from(`xref\n0 ${objects.length + 1}\n`, 'ascii'));
  chunks.push(Buffer.from('0000000000 65535 f \n', 'ascii'));
  for (const value of offsets.slice(1)) {
    chunks.push(Buffer.from(`${String(value).padStart(10, '0')} 00000 n \n`, 'ascii'));
  }
  chunks.push(
    Buffer.from(
      `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`,
      'ascii',
    ),
  );
  return Buffer.concat(chunks);
}

export async function buildQrPngBytes({ payload }) {
  return renderPngBytes(await buildQrMatrix(payload));
}

export async function buildQrPdfBytes({ payload, title }) {
  return renderPdfBytes(await buildQrMatrix(payload), title ?? payload);
}
