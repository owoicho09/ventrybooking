import { AdminSidebar } from '@/components/layout/AdminSidebar';
import { AdminBottomNav } from '@/components/layout/AdminBottomNav';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ backgroundColor: 'var(--color-bg)', minHeight: '100vh' }}>
      <AdminSidebar />
      <main className="w-full min-w-0 max-w-full overflow-x-hidden lg:ml-60 lg:w-[calc(100%-15rem)] min-h-screen p-3 sm:p-4 pb-24 lg:p-8 lg:pb-8">
        {children}
      </main>
      <AdminBottomNav />
    </div>
  );
}
