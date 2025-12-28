export function authMiddleware(req, res, next) {
  const serverApiKey = process.env.SERVER_API_KEY;

  // If no API key is configured, allow all requests (development mode)
  if (!serverApiKey) {
    console.warn('WARNING: SERVER_API_KEY is not set. API is unprotected!');
    return next();
  }

  const providedKey = req.headers['x-api-key'] || req.headers['authorization']?.replace('Bearer ', '');

  if (!providedKey) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'API key is required. Provide it via X-API-Key header or Authorization: Bearer <key>'
    });
  }

  if (providedKey !== serverApiKey) {
    return res.status(403).json({
      error: 'Forbidden',
      message: 'Invalid API key'
    });
  }

  next();
}
