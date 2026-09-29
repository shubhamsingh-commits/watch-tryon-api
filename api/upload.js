import { uploadImage } from '../lib/makeupar.js';
import { withCors, sendError } from '../lib/http.js';

const MAX_BYTES = 10 * 1024 * 1024; // matches Perfect Corp's documented 10MB image limit

function badRequest(message) {
  const error = new Error(message);
  error.status = 400;
  return error;
}

/**
 * Uploads a user-provided photo (e.g. from a file picker or camera capture)
 * to Perfect Corp's File API and returns a fileId. Use this for any image
 * that doesn't already have a public URL — most commonly the user's own
 * wrist photo, since product/watch images are usually already hosted on
 * your site and can be passed directly as refFileUrls.
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
    if (buffer.length === 0) throw badRequest('Image contains no bytes');
    if (buffer.length > MAX_BYTES) {
      throw badRequest(`Image too large (max ${MAX_BYTES / (1024 * 1024)}MB)`);
    }

    const fileId = await uploadImage(buffer, contentType, fileName || 'photo.jpg');
    res.status(200).json({ success: true, fileId });
  } catch (err) {
    sendError(res, err.status || 500, err.message, err.payload);
  }
}
