const ROOT_URL = process.env.MAKEUPAR_ROOT_URL || 'https://yce-api-01.makeupar.com';
const BASE_URL = process.env.MAKEUPAR_BASE_URL || `${ROOT_URL}/s2s/v2.0/task/2d-vto/watch`;
const FILE_URL = `${ROOT_URL}/s2s/v2.0/file`;

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
 * Uploads raw image bytes to Perfect Corp's File API and returns a file_id
 * usable as srcFileId / a refFileIds entry. Needed because the upstream
 * task API can only fetch publicly reachable URLs — a device photo (which
 * only exists as bytes in the browser) has to go through this two-step
 * flow: register the file, then PUT the bytes to the signed URL returned.
 */
export async function uploadImage(buffer, contentType, fileName) {
  const registerRes = await fetch(FILE_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${getApiKey()}`,
    },
    body: JSON.stringify({
      files: [{ content_type: contentType, file_name: fileName, file_size: buffer.length }],
    }),
  });

  const registerText = await registerRes.text();
  let registerPayload;
  try {
    registerPayload = registerText ? JSON.parse(registerText) : {};
  } catch {
    registerPayload = { raw: registerText };
  }

  const registerStatus =
    typeof registerPayload.status === 'number' ? registerPayload.status : registerRes.status;
  if (!registerRes.ok || registerStatus >= 400) {
    const error = new Error(
      registerPayload.error ||
        registerPayload.error_code ||
        `File registration failed with status ${registerStatus}`
    );
    error.status = registerStatus;
    error.payload = registerPayload;
    throw error;
  }

  const fileEntry = registerPayload?.data?.files?.[0] ?? registerPayload?.files?.[0];
  if (!fileEntry?.file_id || !Array.isArray(fileEntry.requests) || fileEntry.requests.length === 0) {
    const error = new Error('Unexpected response from file registration');
    error.status = 502;
    error.payload = registerPayload;
    throw error;
  }

  for (const uploadReq of fileEntry.requests) {
    const uploadRes = await fetch(uploadReq.url, {
      method: uploadReq.method || 'PUT',
      headers: uploadReq.headers || {},
      body: buffer,
    });
    if (!uploadRes.ok) {
      const error = new Error(`File upload to storage failed with status ${uploadRes.status}`);
      error.status = 502;
      throw error;
    }
  }

  return fileEntry.file_id;
}

/**
 * Starts a 2D virtual watch try-on task.
 * Accepts either pre-uploaded file IDs (srcFileId / refFileIds) or direct
 * public image URLs (srcFileUrl / refFileUrls) — the upstream API supports both.
 */
export async function startWatchTryOn(input = {}) {
  const {
    srcFileId,
    srcFileUrl,
    refFileIds = [],
    refFileUrls = [],
    refMaskFileIds = [],
    refMaskFileUrls = [],
    watchOptions = {},
  } = input;

  if (!srcFileId && !srcFileUrl) {
    throw badRequest('srcFileId or srcFileUrl is required');
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

  const refNames = refFileIds.length > 0 ? refFileIds : refFileUrls;
  const objectInfos = refNames.map((name) => ({
    name,
    parameter: {
      watch_need_remove_background: removeBackground,
      watch_wearing_location: wearingLocation,
      watch_shadow_intensity: shadowIntensity,
      watch_ambient_light_intensity: ambientLightIntensity,
    },
  }));

  const body = {
    ...(srcFileId ? { src_file_id: srcFileId } : { src_file_url: srcFileUrl }),
    source_info: { name: srcFileId || srcFileUrl },
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
