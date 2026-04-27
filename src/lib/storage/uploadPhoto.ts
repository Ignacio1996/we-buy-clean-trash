import 'server-only';
import { adminStorage } from '@/lib/firebase/admin';

export interface UploadPhotoInput {
  path: string;
  base64: string;
  contentType: string;
}

export interface UploadPhotoResult {
  url: string;
  mocked: boolean;
}

// Storage is mocked by default until a paid Firebase Storage account is wired up.
// Set STORAGE_MODE=firebase in env to switch to real uploads.
function isMocked(): boolean {
  return (process.env.STORAGE_MODE ?? 'mock').toLowerCase() !== 'firebase';
}

export async function uploadPhoto(input: UploadPhotoInput): Promise<UploadPhotoResult> {
  if (isMocked()) {
    // TODO(phase-post-pilot): drop this branch once paid Firebase Storage is enabled.
    const sizeKb = Math.round((input.base64.length * 0.75) / 1024);
    console.log(
      `[storage-stub] skipped upload path=${input.path} mime=${input.contentType} ~${sizeKb}KB`,
    );
    return { url: `mock://${input.path}`, mocked: true };
  }

  const bucket = adminStorage.bucket();
  const file = bucket.file(input.path);
  const buffer = Buffer.from(input.base64, 'base64');
  await file.save(buffer, { contentType: input.contentType, resumable: false });
  return { url: `gs://${bucket.name}/${input.path}`, mocked: false };
}
