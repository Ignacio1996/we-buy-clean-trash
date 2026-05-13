import { NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase/admin';
import type { WaitlistEntryDoc } from '@/lib/types/waitlist';

export const runtime = 'nodejs';

const EMAIL_RE = /^\S+@\S+\.\S+$/;
const ZIP_RE = /^\d{5}(-\d{4})?$/;

interface ParsedEntry {
  name: string;
  email: string;
  postalCode: string;
}

function parse(raw: unknown): ParsedEntry | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const name = typeof r.name === 'string' ? r.name.trim() : '';
  const email = typeof r.email === 'string' ? r.email.trim().toLowerCase() : '';
  const postalCode = typeof r.postalCode === 'string' ? r.postalCode.trim() : '';
  if (!name || name.length > 100) return null;
  if (!email || email.length > 200 || !EMAIL_RE.test(email)) return null;
  if (!postalCode || !ZIP_RE.test(postalCode)) return null;
  return { name, email, postalCode };
}

export async function POST(request: Request) {
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const parsed = parse(json);
  if (!parsed) {
    return NextResponse.json({ error: 'invalid_payload' }, { status: 400 });
  }

  // Dedupe on email — if they re-submit, refresh the timestamp rather than
  // pile up duplicates. Email is the natural key for a waitlist.
  const existingSnap = await adminDb
    .collection('waitlist')
    .where('email', '==', parsed.email)
    .limit(1)
    .get();

  if (!existingSnap.empty) {
    await existingSnap.docs[0].ref.update({
      name: parsed.name,
      postalCode: parsed.postalCode,
      updatedAt: FieldValue.serverTimestamp(),
    });
    return NextResponse.json({ ok: true, alreadyOnList: true });
  }

  const docRef = adminDb.collection('waitlist').doc();
  const doc: WaitlistEntryDoc = {
    id: docRef.id,
    name: parsed.name,
    email: parsed.email,
    postalCode: parsed.postalCode,
    source: 'landing_pilot',
    createdAt: FieldValue.serverTimestamp() as unknown as WaitlistEntryDoc['createdAt'],
  };
  await docRef.set(doc);

  return NextResponse.json({ ok: true, alreadyOnList: false });
}
