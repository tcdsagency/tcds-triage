import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { Plus_Jakarta_Sans, Inter, JetBrains_Mono } from "next/font/google";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Toaster } from "sonner";
import "./globals.css";

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-plus-jakarta",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "TCDS-Triage",
  description: "AI-Native Insurance Operations Platform",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable} ${plusJakarta.variable} ${inter.variable} ${jetbrainsMono.variable}`}>
      <body className="antialiased font-sans">
        {children}
        <SpeedInsights />
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 4000,
            classNames: {
              toast: 'bg-gray-800 text-gray-100 border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:border-gray-700',
              success: 'bg-green-900/90 border-green-700 text-green-100',
              error: 'bg-red-900/90 border-red-700 text-red-100',
              warning: 'bg-amber-900/90 border-amber-700 text-amber-100',
              info: 'bg-blue-900/90 border-blue-700 text-blue-100',
              description: 'text-gray-400',
              actionButton: 'bg-white text-gray-900 hover:bg-gray-100',
              cancelButton: 'bg-gray-700 text-gray-300 hover:bg-gray-600',
            },
          }}
          richColors
          closeButton
          expand={true}
          visibleToasts={5}
        />
      </body>
    </html>
  );
}
