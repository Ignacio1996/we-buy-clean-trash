import { NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { getSession } from '@/lib/auth/session';
import { loadOperatorRoute } from '@/lib/auth/operatorAccess';

export const runtime = 'nodejs';

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const { id } = await context.params;

  const result = await loadOperatorRoute(session, id);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  const { route, ref } = result.context;

  if (route.status !== 'assigned') {
    return NextResponse.json({ error: 'route_not_startable', status: route.status }, { status: 409 });
  }

  await ref.update({
    status: 'in_progress',
    startedAt: FieldValue.serverTimestamp(),
  });

  return NextResponse.json({ ok: true });
}
