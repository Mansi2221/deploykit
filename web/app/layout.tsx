import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "deploykit — Production Readiness Scanner for AI Apps",
  description: "Scan your AI application. Get a deploy/no-deploy verdict.",
  openGraph: {
    title: "deploykit — Production Readiness Scanner for AI Apps",
    description: "Scan your AI application. Get a deploy/no-deploy verdict.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "deploykit — Production Readiness Scanner for AI Apps",
    description: "Scan your AI application. Get a deploy/no-deploy verdict.",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-[#0a0a0a]">{children}</body>
    </html>
  );
}
