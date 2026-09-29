# watch-tryon-api

Serverless API for virtual watch try-on. Wraps the upstream 2D VTO "watch"
engine (async task-based) behind a simple REST interface, ready to deploy on
Vercel.

> **Two ways to supply images:**
> 1. **Direct URLs** (simplest — no upload step): pass `srcFileUrl` (the
>    person's wrist/arm photo) and `refFileUrls` (the watch product photo)
>    as publicly reachable image URLs.
> 2. **Pre-uploaded file IDs**: pass `srcFileId` / `refFileIds` if you've
>    already uploaded images to the upstream file storage service and have
>    their file IDs.
>
> Use one or the other per field (don't mix `srcFileId` and `srcFileUrl`).
>
> **Important:** the upstream API fetches these URLs itself from its own
> servers, so they must be **publicly reachable over the internet**. A
> `blob:` URL, `data:` URL, or a local file path from the browser will be
> rejected (`InvalidParameters` / task `error`). If your frontend lets users
> upload a photo from their device, upload it through `POST /api/upload`
> first to get a public URL, then use that URL as `srcFileUrl`.

## Endpoints

### `POST /api/upload`
Uploads a user-provided photo (e.g. from a file picker or camera capture) to
public storage (Vercel Blob) and returns a public URL. Use this for any image
that doesn't already have a public URL — most commonly the user's own wrist
photo, since product/watch images are usually already hosted on your site.

**Body**
```json
{
  "fileName": "wrist.jpg",
  "contentType": "image/jpeg",
  "base64": "<base64-encoded image bytes, no data: prefix>"
}
```
On the frontend, convert the selected `File`/camera capture to base64 (e.g.
via `FileReader.readAsDataURL()`, then strip the `data:image/...;base64,`
prefix) before sending.

**Response**
```json
{ "success": true, "url": "https://<...>.public.blob.vercel-storage.com/tryon-uploads/..." }
```
Use this `url` as `srcFileUrl` (or an entry in `refFileUrls`) in the calls
below. Max upload size is 4MB — resize/compress on the client if needed.

> Requires a Vercel Blob store connected to this project (Vercel dashboard →
> Storage → Create Database → Blob). This auto-provisions the
> `BLOB_READ_WRITE_TOKEN` environment variable the upload code needs.

### `POST /api/tryon/start`
Starts an async try-on task and returns immediately with a `taskId`.

**Body (URL-based — recommended)**
```json
{
  "srcFileUrl": "https://example.com/wrist-photo.png",
  "refFileUrls": ["https://example.com/watch-product.png"],
  "watchOptions": {
    "removeBackground": false,
    "wearingLocation": 0,
    "shadowIntensity": 0.15,
    "ambientLightIntensity": 1
  }
}
```

**Body (file-ID based)**
```json
{
  "srcFileId": "2sux1R+9MOJ6/ghfPJFvwGio7cTkSI2BA9guypq3jRELbKfeLEmuXUa9yH4wuc2K",
  "refFileIds": ["8IDHJBSumvsP2nv7fJ4aCEYk2DX2kspliZtHkP71Y3ILbKfeLEmuXUa9yH4wuc2K"]
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
| `PERFECT_CORP_API_KEY` | yes | Bearer token for the upstream try-on API |
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
vercel env add PERFECT_CORP_API_KEY
```

Redeploy after adding env vars:

```bash
vercel --prod
```

## Security

- Never commit `.env` or hardcode `PERFECT_CORP_API_KEY` — it is read only from
  environment variables at request time.
- If this key has ever been shared in plaintext (chat, screenshots, scripts),
  rotate it with the upstream provider before going to production.
