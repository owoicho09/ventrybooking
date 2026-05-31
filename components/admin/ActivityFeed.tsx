import { UserCheck, CalendarCheck, MessageSquareWarning, Wallet, AlertTriangle, FileText } from 'lucide-react';

interface ActivityItem {
  id: number;
  type: string;
  message: string;
  time: string;
}

const icons: Record<string, typeof UserCheck> = {
  kyc_approved: UserCheck,
  kyc_submitted: FileText,
  event_approved: CalendarCheck,
  event_submitted: FileText,
  complaint: MessageSquareWarning,
  payout: Wallet,
  fraud: AlertTriangle,
};

const iconColors: Record<string, string> = {
  kyc_approved: 'var(--color-green)',
  kyc_submitted: 'var(--color-text-muted)',
  event_approved: 'var(--color-green)',
  event_submitted: 'var(--color-text-muted)',
  complaint: 'var(--color-amber)',
  payout: 'var(--color-purple-light)',
  fraud: 'var(--color-red)',
};

export function ActivityFeed({ activities }: { activities: ActivityItem[] }) {
  return (
    <div className="flex flex-col gap-0">
      {activities.map((activity, i) => {
        const Icon = icons[activity.type] || FileText;
        const color = iconColors[activity.type] || 'var(--color-text-muted)';

        return (
          <div
            key={activity.id}
            className="flex items-start gap-4 py-4 border-b last:border-0"
            style={{ borderColor: 'var(--color-border)' }}
          >
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
              style={{
                backgroundColor: `${color}15`,
                color,
              }}
            >
              <Icon size={15} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm" style={{ color: 'var(--color-text)' }}>
                {activity.message}
              </p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-dim)' }}>
                {activity.time}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
