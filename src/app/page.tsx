import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth/session';

export default async function HomePage() {
  const user = await getSession();

  if (user) {
    redirect('/dashboard');
  } else {
    redirect('/careers');
  }
}
