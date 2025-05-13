import type { Metadata } from 'next';
import { GeistSans } from 'geist/font/sans'; // Corrected import path
import { GeistMono } from 'geist/font/mono'; // Corrected import path
import './globals.css';
import { Toaster } from '@/components/ui/toaster';
import { AuthProvider } from '@/components/auth/AuthContext';

const geistSans = GeistSans; // Use the imported variable directly

const geistMono = GeistMono; // Use the imported variable directly

export const metadata: Metadata = {
  title: 'IASL EC Manager',
  description: 'Inspection and Engineering Checklist Management',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased font-sans`}>
        <AuthProvider>
          {children}
          <Toaster />
        </AuthProvider>
      </body>
    </html>
  );
}
