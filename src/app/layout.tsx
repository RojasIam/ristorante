import type { Metadata } from "next";
// We are switching to standard Google Fonts import via Next.js or generic font packages 
// to avoid local file path issues if the fonts folder wasn't generated correctly.
import { Inter } from "next/font/google";
import "./globals.css";
import { ToastProvider } from "@/context/ToastContext";

const inter = Inter({
  variable: "--font-inter", // Custom variable name
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Ristorante Gestionale",
  description: "Sistema di gestione interna.",
  icons: {
    icon: "/logo-gars.webp",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="it" suppressHydrationWarning>
      <body
        className={`${inter.className} antialiased min-h-screen bg-gray-50 text-gray-900`}
      >
        <ToastProvider>
          {children}
        </ToastProvider>
      </body>
    </html>
  );
}
