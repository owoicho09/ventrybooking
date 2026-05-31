import { OrganizerSidebar } from '@/components/layout/OrganizerSidebar';

export default function OrganizerAppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ backgroundColor: 'var(--color-bg)', minHeight: '100vh' }}>
      <OrganizerSidebar />
      <main className="ml-60 min-h-screen p-8">
        {children}
      </main>
    </div>
  );
}
