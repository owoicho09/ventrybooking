import { ForgotPasswordForm } from '@/components/auth/ForgotPasswordForm';

export default function ForgotPasswordPage() {
  return <ForgotPasswordForm account="organizer" loginHref="/organizer/login" />;
}
