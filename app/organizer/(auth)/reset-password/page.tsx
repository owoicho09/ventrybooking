import { ResetPasswordForm } from '@/components/auth/ResetPasswordForm';

export default function ResetPasswordPage() {
  return <ResetPasswordForm loginHref="/organizer/login" forgotHref="/organizer/forgot-password" />;
}
