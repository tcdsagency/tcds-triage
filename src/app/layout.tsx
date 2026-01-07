import type { Metadata } from "next";
import "./globals.css";

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
    <html lang="en">
      <body className="antialiased font-sans">
        {children}
      </body>
    </html>
  );
}
