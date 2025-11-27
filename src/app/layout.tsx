// src/app/layout.tsx
import type { Metadata, Viewport } from 'next';
import { GeistSans } from 'geist/font/sans';
import { GeistMono } from 'geist/font/mono';
import './globals.css';
import { Toaster } from '@/components/ui/toaster';
import { AuthProvider } from '@/components/auth/AuthContext';
import Head from 'next/head'; // Import Head
import { FirebaseErrorListener } from '@/components/FirebaseErrorListener';

export const metadata: Metadata = {
  title: 'IASL EC Manager',
  description: 'Inspection and Electronic Checklist Manager',
  manifest: '/manifest.json', // Added manifest link
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#F0F0F0' },
    { media: '(prefers-color-scheme: dark)', color: '#0A214F' },
  ],
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
};


export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <Head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#0A214F" />
        {/* Add other PWA related meta tags if needed */}
      </Head>
      <body
        className={`${GeistSans.variable} ${GeistMono.variable} antialiased font-sans`}
        suppressHydrationWarning
      >
        <AuthProvider>
          <FirebaseErrorListener />
          {children}
        </AuthProvider>
        <Toaster />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', () => {
                  navigator.serviceWorker.register('/sw.js')
                    .then((registration) => {
                      console.log('Service Worker registered with scope:', registration.scope);
                    })
                    .catch((error) => {
                      console.error('Service Worker registration failed:', error);
                    });
                });
              }
            `,
          }}
        />
      </body>
    </html>
  );
}
