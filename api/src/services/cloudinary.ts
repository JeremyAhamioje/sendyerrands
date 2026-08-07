import { createHash } from 'node:crypto';

import { env, features } from '@/config/env';
import { AppError } from '@/lib/errors';

/**
 * Cloudinary media handling for rider documents, errand photos and proof of
 * delivery.
 *
 * The app uploads DIRECTLY to Cloudinary using a short-lived signature minted
 * here — binary never passes through this API. That keeps request sizes small
 * and means a 4MB photo on a bad Lagos connection can't tie up a Node worker.
 *
 * Flow:
 *   1. App  → POST /uploads/signature { folder: "rider-documents" }
 *   2. API  → { signature, timestamp, apiKey, cloudName, folder }
 *   3. App  → POST https://api.cloudinary.com/v1_1/{cloudName}/image/upload
 *             (multipart: file + the fields above)
 *   4. App  → sends the returned secure_url back to whichever endpoint needs it
 */

/** Folders map to the things we store, so assets stay browsable in the console. */
export const UPLOAD_FOLDERS = [
  'rider-documents',
  'proof-of-delivery',
  'errand-photos',
  'request-photos',
  'vendor-covers',
  'product-images',
  'avatars',
] as const;

export type UploadFolder = (typeof UPLOAD_FOLDERS)[number];

function assertConfigured() {
  if (!features.cloudinary) {
    throw new AppError(
      503,
      'UPLOADS_UNAVAILABLE',
      'Image uploads are not configured. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET.'
    );
  }
}

/**
 * Cloudinary signs the alphabetically-sorted, ampersand-joined params with
 * SHA-1 and the API secret appended. `file` and `api_key` are excluded.
 */
function sign(params: Record<string, string | number>): string {
  const toSign = Object.keys(params)
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join('&');

  return createHash('sha1').update(`${toSign}${env.CLOUDINARY_API_SECRET}`).digest('hex');
}

export function createUploadSignature(folder: UploadFolder, publicId?: string) {
  assertConfigured();

  const timestamp = Math.floor(Date.now() / 1000);
  const fullFolder = `${env.CLOUDINARY_UPLOAD_FOLDER}/${folder}`;

  const params: Record<string, string | number> = {
    folder: fullFolder,
    timestamp,
  };
  if (publicId) params.public_id = publicId;

  return {
    signature: sign(params),
    timestamp,
    folder: fullFolder,
    apiKey: env.CLOUDINARY_API_KEY!,
    cloudName: env.CLOUDINARY_CLOUD_NAME!,
    uploadUrl: `https://api.cloudinary.com/v1_1/${env.CLOUDINARY_CLOUD_NAME}/image/upload`,
    ...(publicId ? { publicId } : {}),
  };
}

/** Removes an asset — used when a rider replaces a rejected document. */
export async function destroyAsset(publicId: string): Promise<boolean> {
  assertConfigured();

  const timestamp = Math.floor(Date.now() / 1000);
  const signature = sign({ public_id: publicId, timestamp });

  const body = new URLSearchParams({
    public_id: publicId,
    timestamp: String(timestamp),
    api_key: env.CLOUDINARY_API_KEY!,
    signature,
  });

  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${env.CLOUDINARY_CLOUD_NAME}/image/destroy`,
    { method: 'POST', body }
  );

  const payload = (await res.json()) as { result?: string };
  return payload.result === 'ok';
}

/**
 * Guards against a client sending us a URL on someone else's host. Anything
 * stored as a `fileUrl` / `proofUrl` must actually live in our Cloudinary
 * account — otherwise a rider could "prove" delivery with any image on the web.
 */
export function isOwnCloudinaryUrl(url: string): boolean {
  if (!features.cloudinary) return true; // nothing to check against yet
  try {
    const parsed = new URL(url);
    return (
      parsed.hostname === 'res.cloudinary.com' &&
      parsed.pathname.startsWith(`/${env.CLOUDINARY_CLOUD_NAME}/`)
    );
  } catch {
    return false;
  }
}
