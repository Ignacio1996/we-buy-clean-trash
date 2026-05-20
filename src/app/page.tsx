import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth/session';
import { ROLE_HOME_PATH } from '@/lib/types/role';
import { LandingPage } from './(landing)/LandingPage';

export const metadata = {
  title: 'We Buy Clean Trash — Turning recyclables into rewards.',
  description:
    'Separate your clean cans, bottles, and cardboard into pickup bags. Leave them door side and earn rewards with every pickup. Built by operators with 40+ years in recycling.',
};

export default async function Home() {
  const session = await getSession();
  if (session) redirect(ROLE_HOME_PATH[session.role]);
  return <LandingPage />;
}
