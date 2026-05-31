import { AdminSidebar } from '@/components/layout/AdminSidebar';
import { AdminBottomNav } from '@/components/layout/AdminBottomNav';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ backgroundColor: 'var(--color-bg)', minHeight: '100vh' }}>
      <AdminSidebar />
      <main className="lg:ml-60 min-h-screen p-4 pb-20 lg:p-8 lg:pb-8">
        {children}
      </main>
      <AdminBottomNav />
    </div>
  );
}
