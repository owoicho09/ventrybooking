'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { Bell, ShoppingBag, FileCheck, AlertCircle, Wallet, UserCheck, X } from 'lucide-react';
import Link from 'next/link';

interface Notification {
  id:         string;
  type:       string;
  title:      string;
  body:       string;
  link:       string | null;
  read:       boolean;
  created_at: string;
}

const TYPE_ICON: Record<string, React.ElementType> = {
  purchase:  ShoppingBag,
  event:     FileCheck,
  complaint: AlertCircle,
  payout:    Wallet,
  kyc:       UserCheck,
};

function timeAgo(iso: string): string {
  const secs = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (secs < 60)   return 'just now';
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`;
  return `${Math.floor(secs / 86400)}d ago`;
}

export function NotificationBell() {
  const [open,          setOpen]          = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unread,        setUnread]        = useState(0);
  const panelRef = useRef<HTMLDivElement>(null);

  const fetchNotifications = useCallback(async () => {
    try {
      const res  = await fetch('/api/notifications');
      const data = await res.json();
      if (data.success) {
        setNotifications(data.data.notifications);
        setUnread(data.data.unread);
      }
    } catch { /* network error — ignore, retry on next poll */ }
  }, []);

  // Initial load + 30-second polling
  useEffect(() => {
    fetchNotifications();
    const id = setInterval(fetchNotifications, 30_000);
    return () => clearInterval(id);
  }, [fetchNotifications]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const markAllRead = async () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    setUnread(0);
    await fetch('/api/notifications', { method: 'PATCH' });
  };

  const markOneRead = async (id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    setUnread(prev => Math.max(0, prev - 1));
    await fetch(`/api/notifications/${id}/read`, { method: 'PATCH' });
  };

  const handleOpen = () => {
    setOpen(o => !o);
    if (!open) fetchNotifications();
  };

  return (
    <div className="relative" ref={panelRef}>
      {/* Bell button */}
      <button
        onClick={handleOpen}
        className="relative flex items-center justify-center w-8 h-8 rounded-lg transition-colors"
        style={{ color: open ? 'var(--color-purple-light)' : 'var(--color-text-muted)' }}
        aria-label="Notifications"
      >
        <Bell size={18} />
        {unread > 0 && (
          <span
            className="absolute -top-1 -right-1 flex items-center justify-center rounded-full text-white font-bold"
            style={{
              backgroundColor: '#ef4444',
              fontSize: '9px',
              minWidth: '16px',
              height: '16px',
              padding: '0 3px',
            }}
          >
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      {/* Dropdown panel */}
      {open && (
        <div
          className="absolute right-0 top-10 z-50 w-80 rounded-xl border shadow-xl overflow-hidden"
          style={{
            backgroundColor: 'var(--color-surface)',
            borderColor:     'var(--color-border)',
            maxHeight:       '480px',
          }}
        >
          {/* Header */}
          <div
            className="flex items-center justify-between px-4 py-3 border-b"
            style={{ borderColor: 'var(--color-border)' }}
          >
            <span className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>
              Notifications {unread > 0 && (
                <span className="ml-1 text-xs px-1.5 py-0.5 rounded-full font-bold"
                  style={{ backgroundColor: '#ef444422', color: '#ef4444' }}>
                  {unread} new
                </span>
              )}
            </span>
            <div className="flex items-center gap-2">
              {unread > 0 && (
                <button
                  onClick={markAllRead}
                  className="text-xs font-medium hover:underline"
                  style={{ color: 'var(--color-purple-light)' }}
                >
                  Mark all read
                </button>
              )}
              <button onClick={() => setOpen(false)} style={{ color: 'var(--color-text-dim)' }}>
                <X size={14} />
              </button>
            </div>
          </div>

          {/* List */}
          <div className="overflow-y-auto" style={{ maxHeight: '400px' }}>
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 gap-2">
                <Bell size={28} style={{ color: 'var(--color-text-dim)' }} />
                <p className="text-sm" style={{ color: 'var(--color-text-dim)' }}>No notifications yet</p>
              </div>
            ) : (
              notifications.map(n => {
                const Icon = TYPE_ICON[n.type] ?? Bell;
                const inner = (
                  <div
                    key={n.id}
                    className="flex items-start gap-3 px-4 py-3 border-b cursor-pointer transition-colors"
                    style={{
                      borderColor:     'var(--color-border)',
                      backgroundColor: n.read ? 'transparent' : 'var(--color-purple-dim)',
                    }}
                    onClick={() => { if (!n.read) markOneRead(n.id); }}
                  >
                    <div
                      className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center mt-0.5"
                      style={{ backgroundColor: 'var(--color-surface-2)' }}
                    >
                      <Icon size={15} style={{ color: 'var(--color-purple-light)' }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold truncate" style={{ color: 'var(--color-text)' }}>
                        {n.title}
                      </p>
                      <p className="text-xs mt-0.5 leading-snug line-clamp-2" style={{ color: 'var(--color-text-muted)' }}>
                        {n.body}
                      </p>
                      <p className="text-[10px] mt-1" style={{ color: 'var(--color-text-dim)' }}>
                        {timeAgo(n.created_at)}
                      </p>
                    </div>
                    {!n.read && (
                      <span
                        className="flex-shrink-0 w-2 h-2 rounded-full mt-2"
                        style={{ backgroundColor: '#ef4444' }}
                      />
                    )}
                  </div>
                );

                return n.link ? (
                  <Link key={n.id} href={n.link} onClick={() => { setOpen(false); if (!n.read) markOneRead(n.id); }}>
                    {inner}
                  </Link>
                ) : (
                  <div key={n.id}>{inner}</div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
