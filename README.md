# watch-tryon-api

Serverless API for virtual watch try-on. Wraps the upstream 2D VTO "watch"
engine (async task-based) behind a simple REST interface, ready to deploy on
Vercel.

> **Note on file IDs:** `srcFileId` (the person's wrist/arm photo) and
> `refFileIds` (the watch product photo) must already be uploaded to the
> upstream file storage service and referenced by their file ID — the same
> way `src_file_id` / `ref_file_ids` are used in the upstream task API. This
> service does not perform the upload step itself.

## Endpoints

### `POST /api/tryon/start`
Starts an async try-on task and returns immediately with a `taskId`.

**Body**
```json
{
  "srcFileId": "2sux1R+9MOJ6/ghfPJFvwGio7cTkSI2BA9guypq3jRELbKfeLEmuXUa9yH4wuc2K",
  "refFileIds": ["8IDHJBSumvsP2nv7fJ4aCEYk2DX2kspliZtHkP71Y3ILbKfeLEmuXUa9yH4wuc2K"],
  "watchOptions": {
    "removeBackground": false,
    "wearingLocation": 0,
    "shadowIntensity": 0.15,
    "ambientLightIntensity": 1
  }
}
```
`watchOptions` is optional; values above are the defaults.

**Response**
```json
{ "success": true, "taskId": "..." }
```

### `GET /api/tryon/{taskId}`
Polls a task once and returns its current status.

**Response (processing)**
```json
{ "success": true, "taskId": "...", "status": "processing", "imageUrl": null }
```

**Response (success)**
```json
{
  "success": true,
  "taskId": "...",
  "status": "success",
  "imageUrl": "https://.../result.png?X-Amz-..."
}
```
`imageUrl` is a temporary, signed URL (expires after a couple of hours) — download
or forward it promptly.

### `POST /api/tryon`
Convenience endpoint: starts the task and polls internally (every 2s, up to
~50s) so the caller gets one request/response for the whole flow. If the task
is still running when the internal timeout is hit, it returns `status:
"pending"` with the `taskId` so the client can fall back to polling
`GET /api/tryon/{taskId}`.

Same request body as `/api/tryon/start`.

### `GET /api/health`
Basic liveness check.

## Environment variables

Copy `.env.example` to `.env` for local development:

| Variable | Required | Description |
|---|---|---|
| `MAKEUPAR_API_KEY` | yes | Bearer token for the upstream try-on API |
| `MAKEUPAR_BASE_URL` | no | Override upstream base URL |
| `ALLOWED_ORIGIN` | no | CORS origin allowed to call this API (default `*`) |

## Local development

```bash
npm i -g vercel
vercel dev
```

## Deploy to Vercel

```bash
vercel
```

Then set the environment variables in the Vercel dashboard (Project →
Settings → Environment Variables), or via CLI:

```bash
vercel env add MAKEUPAR_API_KEY
```

Redeploy after adding env vars:

```bash
vercel --prod
```

## Security

- Never commit `.env` or hardcode `MAKEUPAR_API_KEY` — it is read only from
  environment variables at request time.
- If this key has ever been shared in plaintext (chat, screenshots, scripts),
  rotate it with the upstream provider before going to production.
