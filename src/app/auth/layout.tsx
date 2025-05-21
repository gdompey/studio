import type { ReactNode } from 'react';
import Image from 'next/image';
import {APP_NAME} from '@/lib/constants';

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-secondary p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Image 
            src="/company-logo.png" 
            alt={`${APP_NAME} Logo`}
            width={80}
            height={80}
            className="mx-auto rounded-lg shadow-md mb-4"
            data-ai-hint="company logo"
          />
          <h1 className="text-3xl font-bold text-primary">{APP_NAME}</h1>
        </div>
        <div className="bg-card p-6 sm:p-8 rounded-lg shadow-xl">
          {children}
        </div>
      </div>
    </div>
  );
}
