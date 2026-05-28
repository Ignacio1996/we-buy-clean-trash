import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { deleteResidentCompletely } from '@/lib/admin/deleteResident';

const MAX_PER_REQUEST = 100;

export async function POST(request: Request) {
  const session = await getSession();
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }
  const raw = (json ?? {}) as Record<string, unknown>;
  const uids = Array.isArray(raw.uids)
    ? Array.from(
        new Set(
          (raw.uids as unknown[]).filter((x): x is string => typeof x === 'string' && x.length > 0),
        ),
      )
    : [];

  if (uids.length === 0) {
    return NextResponse.json({ error: 'no_uids' }, { status: 400 });
  }
  if (uids.length > MAX_PER_REQUEST) {
    return NextResponse.json({ error: 'too_many', max: MAX_PER_REQUEST }, { status: 400 });
  }

  // An admin can never delete themselves through this endpoint.
  if (uids.includes(session.uid)) {
    return NextResponse.json({ error: 'cannot_delete_self' }, { status: 400 });
  }

  // Sequential — keeps Firestore load predictable and surfaces a clean
  // per-uid result list for the UI to report partial failures.
  const results = [];
  for (const uid of uids) {
    results.push(await deleteResidentCompletely(uid));
  }
  const deleted = results.filter((r) => r.ok).length;
  const failed = results.length - deleted;

  return NextResponse.json({ ok: failed === 0, deleted, failed, results });
}
