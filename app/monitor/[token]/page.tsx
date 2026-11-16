import type { Metadata } from 'next';
import { MonitorView } from '@/components/monitor/MonitorView';

// A shared, secret link: never indexed, never leaks its URL to other sites.
export const metadata: Metadata = {
  title: 'Live event report | Ventry',
  robots: { index: false, follow: false, nocache: true },
  referrer: 'no-referrer',
};

export default async function MonitorPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <MonitorView token={token} />;
}
