// src/app/auth/signin/page.tsx
import { SignInForm } from '@/components/auth/SignInForm';
import Link from 'next/link';

export default function SignInPage() {
  return (
    <>
      <h2 className="text-2xl font-semibold text-center text-foreground mb-6">Welcome Back</h2>
      <SignInForm />
      <p className="mt-6 text-center text-sm text-muted-foreground">
        Don&apos;t have an account?{' '}
        <Link href="/auth/signup" className="font-medium text-primary hover:underline">
          Sign up
        </Link>
      </p>
    </>
  );
}
