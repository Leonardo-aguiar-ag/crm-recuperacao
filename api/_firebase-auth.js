const { createRemoteJWKSet, jwtVerify } = require('jose');

const PROJECT_ID = 'crm-recuperacao';
const issuer = `https://securetoken.google.com/${PROJECT_ID}`;
const jwks = createRemoteJWKSet(new URL('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com'));

async function requireFirebaseUser(req) {
  const header = req.headers.authorization || '';
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    const error = new Error('Autenticação obrigatória.');
    error.statusCode = 401;
    throw error;
  }

  let payload;
  try {
    ({ payload } = await jwtVerify(match[1], jwks, {
      issuer,
      audience: PROJECT_ID,
    }));
  } catch (cause) {
    const error = new Error('Token Firebase expirado ou inválido.');
    error.statusCode = 401;
    error.cause = cause;
    throw error;
  }

  if (payload.sub !== payload.user_id || !payload.sub) {
    const error = new Error('Token Firebase inválido.');
    error.statusCode = 401;
    throw error;
  }

  return { uid: payload.sub, email: payload.email || null };
}

function sendJson(res, status, body) {
  res.status(status).setHeader('Content-Type', 'application/json; charset=utf-8').send(JSON.stringify(body));
}

module.exports = { requireFirebaseUser, sendJson };
