const BASE_URL =
  process.env.MAKEUPAR_BASE_URL ||
  'https://yce-api-01.makeupar.com/s2s/v2.0/task/2d-vto/watch';

function getApiKey() {
  const key = process.env.PERFECT_CORP_API_KEY;
  if (!key) {
    const error = new Error('PERFECT_CORP_API_KEY environment variable is not set');
    error.status = 500;
    throw error;
  }
  return key;
}

function badRequest(message) {
  const error = new Error(message);
  error.status = 400;
  return error;
}

async function request(method, path, body) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${getApiKey()}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  let payload;
  try {
    payload = text ? JSON.parse(text) : {};
  } catch {
    payload = { raw: text };
  }

  const apiStatus = typeof payload.status === 'number' ? payload.status : res.status;
  if (!res.ok || apiStatus >= 400) {
    const error = new Error(
      payload.error || payload.error_code || `Upstream request failed with status ${apiStatus}`
    );
    error.status = apiStatus;
    error.payload = payload;
    throw error;
  }

  return payload;
}

/**
 * Starts a 2D virtual watch try-on task.
 * srcFileId / refFileIds must already be uploaded to the Makeupar file service.
 */
export async function startWatchTryOn(input = {}) {
  const {
    srcFileId,
    refFileIds = [],
    refFileUrls = [],
    refMaskFileIds = [],
    refMaskFileUrls = [],
    watchOptions = {},
  } = input;

  if (!srcFileId) {
    throw badRequest('srcFileId is required');
  }
  if (refFileIds.length === 0 && refFileUrls.length === 0) {
    throw badRequest('refFileIds or refFileUrls must contain at least one watch reference image');
  }

  const {
    removeBackground = false,
    wearingLocation = 0,
    shadowIntensity = 0.15,
    ambientLightIntensity = 1,
  } = watchOptions;

  const objectInfos = refFileIds.map((id) => ({
    name: id,
    parameter: {
      watch_need_remove_background: removeBackground,
      watch_wearing_location: wearingLocation,
      watch_shadow_intensity: shadowIntensity,
      watch_ambient_light_intensity: ambientLightIntensity,
    },
  }));

  const body = {
    src_file_id: srcFileId,
    source_info: { name: srcFileId },
    ref_file_urls: refFileUrls,
    ref_file_ids: refFileIds,
    refmsk_file_urls: refMaskFileUrls,
    refmsk_file_ids: refMaskFileIds,
    object_infos: objectInfos,
  };

  const payload = await request('POST', '', body);
  const taskId = payload?.data?.task_id;
  if (!taskId) {
    const error = new Error('task_id missing from upstream response');
    error.status = 502;
    error.payload = payload;
    throw error;
  }

  return { taskId, raw: payload };
}

export async function getWatchTryOnStatus(taskId) {
  if (!taskId) {
    throw badRequest('taskId is required');
  }
  return request('GET', `/${taskId}`);
}
