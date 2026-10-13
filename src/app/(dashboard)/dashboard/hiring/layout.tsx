import { HiringWorkspaceNav } from '@/components/layout/WorkspaceNav';

export default function HiringLayout({ children }: { children: React.ReactNode }) {
 return <div className="wp-redesign space-y-6"><HiringWorkspaceNav />{children}</div>;
}
