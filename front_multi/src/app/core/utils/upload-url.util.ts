import { environment } from '../../../environments/environment';

export function resolveUploadUrl(value: unknown, fallback = ''): string {
  if (!value || typeof value !== 'string') return fallback;

  const backendBaseUrl = environment.apiUrl.replace(/\/api\/?$/, '').replace(/\/+$/, '');
  const uploadPrefix = String((environment as any).uploadPublicPrefix || 'uploads').replace(/^\/+|\/+$/g, '');

  if (value.startsWith('data:')) return value;

  if (/^https?:\/\//i.test(value)) {
    return normalizeAbsoluteUploadUrl(value, uploadPrefix);
  }

  const path = normalizeUploadPath(value, uploadPrefix);
  return `${backendBaseUrl}/${path}`;
}

function normalizeAbsoluteUploadUrl(value: string, uploadPrefix: string): string {
  try {
    const url = new URL(value);
    const pathname = url.pathname.replace(/^\/+/, '');
    if (pathname.startsWith('public/uploads/')) return value;
    if (pathname.startsWith('uploads/')) {
      url.pathname = '/' + withUploadPrefix(pathname, uploadPrefix);
      return url.toString();
    }
    if (pathname.startsWith('upload/')) {
      url.pathname = '/' + withUploadPrefix(`uploads/${pathname.slice('upload/'.length)}`, uploadPrefix);
      return url.toString();
    }
    return value;
  } catch {
    return value;
  }
}

function normalizeUploadPath(value: string, uploadPrefix: string): string {
  let path = value.replace(/^\/+/, '');

  if (path.startsWith('public/uploads/')) {
    return path;
  }

  if (path.startsWith('upload/')) {
    path = `uploads/${path.slice('upload/'.length)}`;
  }

  if (!path.startsWith('uploads/') && !path.startsWith('storage/')) {
    path = `uploads/${path}`;
  }

  if (path.startsWith('uploads/')) {
    return withUploadPrefix(path, uploadPrefix);
  }

  return path;
}

function withUploadPrefix(path: string, uploadPrefix: string): string {
  if (uploadPrefix === 'uploads') return path;
  return `${uploadPrefix}/${path.slice('uploads/'.length)}`;
}
