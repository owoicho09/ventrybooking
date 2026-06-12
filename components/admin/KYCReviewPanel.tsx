'use client';

import { useState } from 'react';
import { Mail, Phone, MapPin, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Textarea } from '@/components/ui/Input';
import type { Organizer } from '@/types';

interface KYCReviewPanelProps {
  organizer: Organizer;
  onApprove?: () => void;
  onReject?: (reason: string) => void;
}

export function KYCReviewPanel({ organizer, onApprove, onReject }: KYCReviewPanelProps) {
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectForm, setShowRejectForm] = useState(false);

  return (
    <div className="flex flex-col gap-6">
      {/* Organizer info */}
      <div className="flex items-center gap-3">
        <div
          className="w-12 h-12 rounded-full flex items-center justify-center text-xl font-bold text-white flex-shrink-0"
          style={{ backgroundColor: 'var(--color-purple)' }}
        >
          {organizer.name[0]}
        </div>
        <div>
          <p className="font-semibold" style={{ color: 'var(--color-text)' }}>
            {organizer.name}
          </p>
          <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
            {organizer.email}
          </p>
        </div>
        <Badge variant="amber" className="ml-auto">Pending Review</Badge>
      </div>

      {/* Email verification status */}
      <div
        className="rounded-lg border p-4 flex flex-col gap-3"
        style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface-2)' }}
      >
        {[
          { icon: Mail, label: 'Email', value: organizer.email },
          { icon: Phone, label: 'Phone', value: organizer.phone },
          { icon: MapPin, label: 'Registered', value: organizer.submittedAt ?? organizer.memberSince ?? 'N/A' },
        ].map(({ icon: Icon, label, value }) => (
          <div key={label} className="flex items-center gap-3">
            <Icon size={15} style={{ color: 'var(--color-text-dim)' }} />
            <div className="flex-1">
              <p className="text-xs" style={{ color: 'var(--color-text-dim)' }}>{label}</p>
              <p className="text-sm" style={{ color: 'var(--color-text)' }}>{value}</p>
            </div>
          </div>
        ))}
        <div className="flex items-center gap-2 pt-1 mt-1 border-t" style={{ borderColor: 'var(--color-border)' }}>
          <CheckCircle size={14} style={{ color: 'var(--color-green)' }} />
          <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
            Email verified via OTP at registration
          </p>
        </div>
      </div>

      {/* Actions */}
      {!showRejectForm ? (
        <div className="flex gap-3">
          <Button variant="success" fullWidth onClick={onApprove}>
            Approve
          </Button>
          <Button variant="danger" fullWidth onClick={() => setShowRejectForm(true)}>
            Reject
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <Textarea
            label="Rejection Reason"
            placeholder="Explain why this application is being rejected..."
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            rows={3}
          />
          <div className="flex gap-3">
            <Button variant="outline" fullWidth onClick={() => setShowRejectForm(false)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              fullWidth
              onClick={() => onReject?.(rejectReason)}
              disabled={!rejectReason.trim()}
            >
              Confirm Rejection
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
