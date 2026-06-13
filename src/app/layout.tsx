import type { Metadata } from 'next'
import { Geist } from 'next/font/google'
import './globals.css'
import { ToastProvider } from '@/components/ui/Toast'

const geist = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
})

export const metadata: Metadata = {
  title: 'INSEAD 26D Network',
  description: 'Private class directory for INSEAD MBA Class of December 2026',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className={`${geist.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-[#F8F9FC]">
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  )
}
