'use client';

import { useState, useEffect } from 'react';
import { Settings } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

interface PayoutSettings { percentage: number; }

export default function AdminSettingsPage() {
  const [percentage, setPercentage] = useState(100);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch('/api/admin/payout-settings')
      .then(r => r.json())
      .then((d: { success: boolean; data: PayoutSettings }) => { if (d.success) setPercentage(d.data.percentage); })
      .catch(console.error);
  }, []);

  const handleSave = async () => {
    setSaving(true);
    await fetch('/api/admin/payout-settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ percentage }),
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center gap-3">
        <Settings size={22} style={{ color: 'var(--color-purple)' }} />
        <h1 className="text-2xl font-bold"
          style={{ color: 'var(--color-text)', fontFamily: 'var(--font-syne), sans-serif' }}>
          Platform Settings
        </h1>
      </div>

      <div className="rounded-xl border p-6 max-w-lg"
        style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
        <h2 className="font-semibold mb-1" style={{ color: 'var(--color-text)' }}>Payout Settings</h2>
        <p className="text-sm mb-6" style={{ color: 'var(--color-text-muted)' }}>
          Default percentage of escrow released to organizers after event confirmation.
        </p>

        <div className="flex flex-col gap-4">
          <div>
            <label className="text-sm font-medium block mb-2" style={{ color: 'var(--color-text)' }}>
              Default Payout Percentage: <span style={{ color: 'var(--color-purple-light)' }}>{percentage}%</span>
            </label>
            <input type="range" min={0} max={100} value={percentage}
              onChange={(e) => setPercentage(Number(e.target.value))}
              className="w-full accent-[var(--color-purple)]" />
            <div className="flex justify-between text-xs mt-1" style={{ color: 'var(--color-text-dim)' }}>
              <span>0%</span><span>50%</span><span>100%</span>
            </div>
          </div>

          <Input
            label="Percentage (manual)"
            type="number"
            min={0} max={100}
            value={percentage.toString()}
            onChange={e => setPercentage(Math.min(100, Math.max(0, Number(e.target.value))))}
          />

          {saved && (
            <div className="rounded-lg px-4 py-3 text-sm"
              style={{ backgroundColor: '#10b98115', color: 'var(--color-green)' }}>
              Settings saved successfully.
            </div>
          )}

          <Button disabled={saving} onClick={handleSave}>
            {saving ? 'Saving...' : 'Save Settings'}
          </Button>
        </div>
      </div>
    </div>
  );
}
