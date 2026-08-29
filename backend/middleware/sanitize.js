// Sanitização básica de entrada contra XSS.
// Remove tags <script> e atributos de evento (onclick=, onerror=, etc.)
// de todos os campos de texto enviados no corpo das requisições.
// Isso é uma camada extra de proteção - o front-end também deve escapar
// dados ao exibi-los (o que já fazemos usando textContent em vez de innerHTML).

function sanitizeValue(value) {
  if (typeof value !== 'string') return value;
  return value
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
    .replace(/on\w+\s*=\s*"[^"]*"/gi, '')
    .replace(/on\w+\s*=\s*'[^']*'/gi, '')
    .replace(/javascript:/gi, '');
}

function sanitizeObject(obj) {
  if (Array.isArray(obj)) {
    return obj.map(sanitizeObject);
  }
  if (obj && typeof obj === 'object') {
    const clean = {};
    for (const key of Object.keys(obj)) {
      clean[key] = sanitizeObject(obj[key]);
    }
    return clean;
  }
  return sanitizeValue(obj);
}

function sanitizeInputs(req, res, next) {
  if (req.body && typeof req.body === 'object') {
    req.body = sanitizeObject(req.body);
  }
  next();
}

module.exports = { sanitizeInputs };
