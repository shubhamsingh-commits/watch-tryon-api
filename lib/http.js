const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || '*';

export function withCors(req, res) {
  res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGIN);
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return true;
  }
  return false;
}

export function sendError(res, status, message, details) {
  res.status(status).json({
    success: false,
    error: message,
    ...(details ? { details } : {}),
  });
}
