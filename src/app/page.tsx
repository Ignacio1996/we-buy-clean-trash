import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth/session';
import { ROLE_HOME_PATH } from '@/lib/types/role';

export default async function Home() {
  const session = await getSession();
  if (session) redirect(ROLE_HOME_PATH[session.role]);
  redirect('/scan');
}
