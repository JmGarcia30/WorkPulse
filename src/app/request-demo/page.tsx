import { redirect } from 'next/navigation';

// Keep old landing links and bookmarks working without a second onboarding funnel.
export default function RequestDemoPage() {
  redirect('/register');
}
