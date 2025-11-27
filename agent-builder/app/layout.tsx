import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Local Agent Builder',
  description: 'Build and run AI agents locally with tool-use capabilities',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
