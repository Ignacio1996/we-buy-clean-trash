import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth/session';
import { ROLE_HOME_PATH } from '@/lib/types/role';
import { LandingPage } from './(landing)/LandingPage';

export const metadata = {
  title: 'We Buy Clean Trash — We pay you for your recyclables.',
  description:
    'Curbside, zero-commission residential recycling. Bag your aluminum, PET, glass, and cardboard — we pick it up weekly and pay you in gift cards.',
};

export default async function Home() {
  const session = await getSession();
  if (session) redirect(ROLE_HOME_PATH[session.role]);
  return <LandingPage />;
}
