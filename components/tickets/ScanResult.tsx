import { CheckCircle, XCircle, AlertCircle } from 'lucide-react';

type ScanResultType = 'success' | 'already_used' | 'invalid';

interface ScanResultProps {
  result: ScanResultType;
  attendeeName?: string;
  ticketType?: string;
  onDismiss?: () => void;
}

const config: Record<ScanResultType, {
  icon: typeof CheckCircle;
  title: string;
  subtitle: string;
  bg: string;
  color: string;
}> = {
  success: {
    icon: CheckCircle,
    title: 'Access Granted',
    subtitle: '',
    bg: 'var(--color-green)',
    color: '#fff',
  },
  already_used: {
    icon: XCircle,
    title: 'Already Used',
    subtitle: 'This ticket has already been scanned.',
    bg: 'var(--color-red)',
    color: '#fff',
  },
  invalid: {
    icon: AlertCircle,
    title: 'Invalid Ticket',
    subtitle: 'This QR code is not recognised.',
    bg: 'var(--color-amber)',
    color: '#fff',
  },
};

export function ScanResult({ result, attendeeName, ticketType, onDismiss }: ScanResultProps) {
  const { icon: Icon, title, subtitle, bg, color } = config[result];

  return (
    <div
      className="absolute inset-0 flex flex-col items-center justify-center gap-4 z-20"
      style={{ backgroundColor: bg, color }}
    >
      <Icon size={64} strokeWidth={1.5} />
      <div className="text-center">
        <p className="text-3xl font-bold" style={{ fontFamily: 'var(--font-syne), sans-serif' }}>
          {title}
        </p>
        {result === 'success' && attendeeName && (
          <p className="text-xl mt-1 opacity-90">{attendeeName}</p>
        )}
        {result === 'success' && ticketType && (
          <p className="text-sm mt-0.5 opacity-75">{ticketType}</p>
        )}
        {subtitle && <p className="text-sm mt-2 opacity-80">{subtitle}</p>}
      </div>
      {onDismiss && (
        <button
          onClick={onDismiss}
          className="mt-4 px-6 py-2 rounded-lg font-medium text-sm"
          style={{ backgroundColor: 'rgba(255,255,255,0.2)', color: '#fff' }}
        >
          Scan Next
        </button>
      )}
    </div>
  );
}
