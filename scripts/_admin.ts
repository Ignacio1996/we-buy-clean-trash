import { cert, getApp, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

function loadServiceAccount() {
  const raw = process.env.FIREBASE_ADMIN_SA;
  if (!raw) throw new Error('FIREBASE_ADMIN_SA not set — run with --env-file=.env.local');
  const sa = JSON.parse(raw) as { project_id: string; client_email: string; private_key: string };
  return {
    projectId: sa.project_id,
    clientEmail: sa.client_email,
    privateKey: sa.private_key.replace(/\\n/g, '\n'),
  };
}

const app = getApps().length ? getApp() : initializeApp({ credential: cert(loadServiceAccount()) });

export const adminAuth = getAuth(app);
export const adminDb = getFirestore(app);
