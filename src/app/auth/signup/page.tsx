// src/app/auth/signup/page.tsx
import { SignUpForm } from '@/components/auth/SignUpForm';
import Link from 'next/link';

export default function SignUpPage() {
  return (
    <>
      <h2 className="text-2xl font-semibold text-center text-foreground mb-6">Create an Account</h2>
      <SignUpForm />
      <p className="mt-6 text-center text-sm text-muted-foreground">
        Already have an account?{' '}
        <Link href="/auth/signin" className="font-medium text-primary hover:underline">
          Sign in
        </Link>
      </p>
    </>
  );
}
