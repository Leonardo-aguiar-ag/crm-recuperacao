const { checkBotId } = require('botid/server');

async function requireHuman(req, res, sendJson) {
  const requestPath = String(req.url || '').split('?')[0] || '/';
  const verification = await checkBotId({
    advancedOptions: {
      checkLevel: 'basic',
      headers: {
        ...req.headers,
        'x-path': requestPath,
        'x-method': req.method || 'GET',
      },
    },
  });

  if (verification.isBot) {
    sendJson(res, 403, { error: 'Acesso bloqueado pela proteção anti-robô.' });
    return false;
  }

  return true;
}

module.exports = { requireHuman };
