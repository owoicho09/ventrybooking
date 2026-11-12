import { AffiliateAuthShell } from '@/components/auth/AffiliateAuthShell';
import { ResetPasswordForm } from '@/components/auth/ResetPasswordForm';

export default function AffiliateResetPasswordPage() {
  return (
    <AffiliateAuthShell>
      <ResetPasswordForm loginHref="/affiliate/login" forgotHref="/affiliate/forgot-password" />
    </AffiliateAuthShell>
  );
}
