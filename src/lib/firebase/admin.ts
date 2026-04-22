import 'server-only';
import { cert, getApp, getApps, initializeApp, type App } from 'firebase-admin/app';
import { getAuth, type Auth } from 'firebase-admin/auth';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { getStorage, type Storage } from 'firebase-admin/storage';

function loadServiceAccount() {
  const raw = process.env.FIREBASE_ADMIN_SA;
  if (!raw) {
    throw new Error('FIREBASE_ADMIN_SA is not set — add the service account JSON to .env.local');
  }
  try {
    return JSON.parse(raw) as {
      project_id: string;
      client_email: string;
      private_key: string;
    };
  } catch (err) {
    // TEMP diagnostic: include parse-error details + safe shape hints (no secret content).
    const msg = (err as Error).message;
    const len = raw.length;
    const startsWith = raw.slice(0, 1);
    const endsWith = raw.slice(-1);
    const rawNl = (raw.match(/\n/g) || []).length;
    const escNl = (raw.match(/\\n/g) || []).length;
    throw new Error(
      `FIREBASE_ADMIN_SA must be valid JSON: ${msg} (len=${len} start=${JSON.stringify(startsWith)} end=${JSON.stringify(endsWith)} rawNewlines=${rawNl} escapedNewlines=${escNl})`,
    );
  }
}

let _app: App | null = null;
function getAdminApp(): App {
  if (_app) return _app;
  if (getApps().length) {
    _app = getApp();
    return _app;
  }
  const sa = loadServiceAccount();
  _app = initializeApp({
    credential: cert({
      projectId: sa.project_id,
      clientEmail: sa.client_email,
      privateKey: sa.private_key.replace(/\\n/g, '\n'),
    }),
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  });
  return _app;
}

// Lazy proxies: importing this module must not trigger Firebase init, otherwise
// `next build`'s page-data collection crashes when FIREBASE_ADMIN_SA is unset.
function lazyProxy<T extends object>(resolve: () => T): T {
  return new Proxy({} as T, {
    get(_t, prop) {
      const target = resolve();
      const value = Reflect.get(target, prop, target);
      return typeof value === 'function' ? value.bind(target) : value;
    },
    has(_t, prop) {
      return Reflect.has(resolve(), prop);
    },
    ownKeys() {
      return Reflect.ownKeys(resolve());
    },
    getOwnPropertyDescriptor(_t, prop) {
      return Reflect.getOwnPropertyDescriptor(resolve(), prop);
    },
    getPrototypeOf() {
      return Reflect.getPrototypeOf(resolve());
    },
  });
}

export const adminApp: App = lazyProxy(getAdminApp);
export const adminAuth: Auth = lazyProxy(() => getAuth(getAdminApp()));
export const adminDb: Firestore = lazyProxy(() => getFirestore(getAdminApp()));
export const adminStorage: Storage = lazyProxy(() => getStorage(getAdminApp()));
