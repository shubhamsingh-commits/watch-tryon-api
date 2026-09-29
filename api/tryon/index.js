import { startWatchTryOn, getWatchTryOnStatus } from '../../lib/makeupar.js';
import { withCors, sendError } from '../../lib/http.js';

const POLL_INTERVAL_MS = 2000;
const MAX_WAIT_MS = 50000; // stay under the 60s serverless function ceiling

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Convenience endpoint: starts the task and polls it to completion in one call.
 * If the task is still running when MAX_WAIT_MS elapses, returns the taskId
 * so the client can fall back to polling GET /api/tryon/{taskId}.
 */
export default async function handler(req, res) {
  if (withCors(req, res)) return;
  if (req.method !== 'POST') {
    return sendError(res, 405, 'Method not allowed');
  }

  try {
    const { taskId } = await startWatchTryOn(req.body ?? {});
    const deadline = Date.now() + MAX_WAIT_MS;

    while (Date.now() < deadline) {
      const payload = await getWatchTryOnStatus(taskId);
      const status = payload?.data?.task_status;

      if (status === 'success') {
        return res.status(200).json({
          success: true,
          taskId,
          status,
          imageUrl: payload?.data?.results?.url ?? null,
        });
      }

      if (status === 'error') {
        return res.status(502).json({
          success: false,
          taskId,
          status,
          error: payload?.data?.error ?? 'Task failed',
        });
      }

      await sleep(POLL_INTERVAL_MS);
    }

    res.status(202).json({
      success: true,
      taskId,
      status: 'pending',
      message: 'Task is still processing. Poll GET /api/tryon/{taskId} for the result.',
    });
  } catch (err) {
    sendError(res, err.status || 500, err.message, err.payload);
  }
}
