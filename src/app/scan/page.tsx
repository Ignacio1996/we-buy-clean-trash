import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth/session';
import { ROLE_HOME_PATH } from '@/lib/types/role';
import { ScanClient } from './ScanClient';

export const metadata = {
  title: 'See what your trash is worth — We Buy Clean Trash',
  description:
    'Scan your recycling with your camera and see how much cash and points you can earn. No account needed.',
};

export default async function ScanPage() {
  const session = await getSession();
  if (session) redirect(ROLE_HOME_PATH[session.role]);

  return <ScanClient />;
}
