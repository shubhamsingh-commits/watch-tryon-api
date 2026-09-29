import { put } from '@vercel/blob';
import { withCors, sendError } from '../lib/http.js';

const MAX_BYTES = 4 * 1024 * 1024; // keep uploads well under Vercel's request body limit

function badRequest(message) {
  const error = new Error(message);
  error.status = 400;
  return error;
}

/**
 * Uploads a user-provided photo to public storage so it can be passed as
 * srcFileUrl / refFileUrls to the upstream try-on API, which requires a
 * publicly reachable URL (it cannot fetch blob:/data: URLs from the browser).
 */
export default async function handler(req, res) {
  if (withCors(req, res)) return;
  if (req.method !== 'POST') {
    return sendError(res, 405, 'Method not allowed');
  }

  try {
    const { fileName, contentType, base64 } = req.body ?? {};

    if (!base64) throw badRequest('base64 is required');
    if (!contentType) throw badRequest('contentType is required');
    if (!contentType.startsWith('image/')) throw badRequest('contentType must be an image type');

    const buffer = Buffer.from(base64, 'base64');
    if (buffer.length > MAX_BYTES) {
      throw badRequest(`Image too large (max ${MAX_BYTES / (1024 * 1024)}MB)`);
    }

    const safeName = (fileName || 'photo').replace(/[^a-zA-Z0-9_.-]/g, '_');
    const key = `tryon-uploads/${Date.now()}-${safeName}`;

    const blob = await put(key, buffer, {
      access: 'public',
      contentType,
    });

    res.status(200).json({ success: true, url: blob.url });
  } catch (err) {
    sendError(res, err.status || 500, err.message);
  }
}
