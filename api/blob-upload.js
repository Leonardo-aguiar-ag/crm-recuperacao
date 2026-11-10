const { put } = require('@vercel/blob');
const { requireFirebaseUser, sendJson } = require('../lib/firebase-auth');

const MAX_FILE_SIZE = 4.5 * 1024 * 1024;
const ALLOWED_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
]);

function safeName(value) {
  return String(value || 'arquivo')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .slice(-120) || 'arquivo';
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return sendJson(res, 405, { error: 'Método não permitido.' });

  try {
    const user = await requireFirebaseUser(req);
    const filename = safeName(req.query.filename);
    const contentType = String(req.headers['content-type'] || 'application/octet-stream').split(';')[0];
    const contentLength = Number(req.headers['content-length'] || 0);

    if (!ALLOWED_TYPES.has(contentType)) {
      return sendJson(res, 415, { error: 'Tipo de arquivo não permitido.' });
    }
    if (contentLength > MAX_FILE_SIZE) {
      return sendJson(res, 413, { error: 'O arquivo excede o limite de 4,5 MB do upload da Vercel.' });
    }

    const chunks = [];
    let total = 0;
    for await (const chunk of req) {
      total += chunk.length;
      if (total > MAX_FILE_SIZE) return sendJson(res, 413, { error: 'O arquivo excede o limite de 4,5 MB do upload da Vercel.' });
      chunks.push(chunk);
    }
    if (!total) return sendJson(res, 400, { error: 'Arquivo vazio.' });

    const pathname = `clientes/${user.uid}/${Date.now()}-${safeName(filename)}`;
    const blob = await put(pathname, Buffer.concat(chunks), {
      access: 'private',
      contentType,
      addRandomSuffix: true,
    });

    return sendJson(res, 200, {
      url: blob.url,
      pathname: blob.pathname,
      contentType,
      size: total,
      nome: filename,
    });
  } catch (error) {
    console.error('blob-upload:', error);
    return sendJson(res, error.statusCode || 500, { error: error.message || 'Falha no upload.' });
  }
};
