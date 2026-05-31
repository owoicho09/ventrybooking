'use client';

import { useState } from 'react';
import { FileText, Phone, Globe, MapPin } from 'lucide-react';
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

      {/* Document preview areas */}
      <div className="grid grid-cols-2 gap-3">
        {[
          { label: 'Government ID', sub: 'NIN / Driver\'s Licence / Passport' },
          { label: 'Selfie with ID', sub: 'Selfie holding document' },
        ].map(({ label, sub }) => (
          <div
            key={label}
            className="rounded-lg border-2 border-dashed flex flex-col items-center justify-center gap-2 aspect-video cursor-pointer transition-colors hover:border-[var(--color-purple)]"
            style={{ borderColor: 'var(--color-border)' }}
          >
            <FileText size={24} style={{ color: 'var(--color-text-dim)' }} />
            <div className="text-center">
              <p className="text-xs font-medium" style={{ color: 'var(--color-text-muted)' }}>
                {label}
              </p>
              <p className="text-[10px]" style={{ color: 'var(--color-text-dim)' }}>
                {sub}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Verification details */}
      <div
        className="rounded-lg border p-4 flex flex-col gap-3"
        style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface-2)' }}
      >
        {[
          { icon: Phone, label: 'Phone', value: organizer.phone, verified: true },
          { icon: Globe, label: 'Social Media', value: 'Not provided', verified: false },
          { icon: MapPin, label: 'Submitted', value: organizer.submittedAt ?? 'N/A', verified: true },
        ].map(({ icon: Icon, label, value, verified }) => (
          <div key={label} className="flex items-center gap-3">
            <Icon size={15} style={{ color: 'var(--color-text-dim)' }} />
            <div className="flex-1">
              <p className="text-xs" style={{ color: 'var(--color-text-dim)' }}>{label}</p>
              <p className="text-sm" style={{ color: 'var(--color-text)' }}>{value}</p>
            </div>
            {verified ? (
              <Badge variant="green">Verified</Badge>
            ) : (
              <Badge variant="gray">Unverified</Badge>
            )}
          </div>
        ))}
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
