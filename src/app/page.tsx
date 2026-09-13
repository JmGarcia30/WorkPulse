import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth/session';
import { landingPathForRole } from '@/lib/auth/routing';

export default async function HomePage() {
  const user = await getSession();

  if (user) {
    redirect(landingPathForRole(user.role));
  } else {
    redirect('/careers');
  }
}
