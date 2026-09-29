import { getWatchTryOnStatus } from '../../lib/makeupar.js';
import { withCors, sendError } from '../../lib/http.js';

export default async function handler(req, res) {
  if (withCors(req, res)) return;
  if (req.method !== 'GET') {
    return sendError(res, 405, 'Method not allowed');
  }

  const { taskId } = req.query;

  try {
    const payload = await getWatchTryOnStatus(taskId);
    const status = payload?.data?.task_status;

    res.status(200).json({
      success: true,
      taskId,
      status,
      imageUrl: payload?.data?.results?.url ?? null,
      raw: payload,
    });
  } catch (err) {
    sendError(res, err.status || 500, err.message, err.payload);
  }
}
