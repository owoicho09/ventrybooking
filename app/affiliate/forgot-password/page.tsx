import { AffiliateAuthShell } from '@/components/auth/AffiliateAuthShell';
import { ForgotPasswordForm } from '@/components/auth/ForgotPasswordForm';

export default function AffiliateForgotPasswordPage() {
  return (
    <AffiliateAuthShell>
      <ForgotPasswordForm account="affiliate" loginHref="/affiliate/login" />
    </AffiliateAuthShell>
  );
}
