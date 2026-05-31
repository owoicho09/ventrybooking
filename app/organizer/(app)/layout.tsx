import { OrganizerSidebar } from '@/components/layout/OrganizerSidebar';
import { OrganizerBottomNav } from '@/components/layout/OrganizerBottomNav';

export default function OrganizerAppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ backgroundColor: 'var(--color-bg)', minHeight: '100vh' }}>
      <OrganizerSidebar />
      <main className="lg:ml-60 min-h-screen p-4 pb-20 lg:p-8 lg:pb-8">
        {children}
      </main>
      <OrganizerBottomNav />
    </div>
  );
}
