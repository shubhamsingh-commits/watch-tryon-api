import { startWatchTryOn } from '../../lib/makeupar.js';
import { withCors, sendError } from '../../lib/http.js';

export default async function handler(req, res) {
  if (withCors(req, res)) return;
  if (req.method !== 'POST') {
    return sendError(res, 405, 'Method not allowed');
  }

  try {
    const { taskId } = await startWatchTryOn(req.body ?? {});
    res.status(200).json({ success: true, taskId });
  } catch (err) {
    sendError(res, err.status || 500, err.message, err.payload);
  }
}
