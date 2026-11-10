const { get } = require('@vercel/blob');
const { requireFirebaseUser, sendJson } = require('../lib/firebase-auth');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return sendJson(res, 405, { error: 'Método não permitido.' });

  try {
    const user = await requireFirebaseUser(req);
    const pathname = String(req.query.pathname || '');
    if (!pathname || pathname.includes('..') || !pathname.startsWith(`clientes/${user.uid}/`)) {
      return sendJson(res, 400, { error: 'Caminho de arquivo inválido.' });
    }

    const result = await get(pathname, { access: 'private' });
    if (!result || result.statusCode === 404 || !result.stream || !result.blob) {
      return sendJson(res, 404, { error: 'Arquivo não encontrado.' });
    }

    res.statusCode = 200;
    res.setHeader('Cache-Control', 'private, no-cache');
    res.setHeader('Content-Type', result.blob.contentType || 'application/octet-stream');
    res.setHeader('Content-Disposition', 'inline');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    return result.stream.pipe(res);
  } catch (error) {
    console.error('blob-download:', error);
    return sendJson(res, error.statusCode || 500, { error: error.message || 'Falha ao abrir o arquivo.' });
  }
};
