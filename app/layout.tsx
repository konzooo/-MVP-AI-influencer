import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Sidebar } from "@/components/layout/Sidebar";
import { Toaster } from "@/components/ui/sonner";
import { ConvexClientProvider } from "./ConvexClientProvider";
import { AuthGate } from "@/components/auth/AuthGate";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "AI Influencer Studio",
  description: "Content creation pipeline for AI influencer accounts",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${geistSans.variable} ${geistMono.variable} font-sans antialiased`}
      >
        <ConvexClientProvider>
          <AuthGate sidebar={<Sidebar />}>
            {children}
          </AuthGate>
          <Toaster position="bottom-right" />
        </ConvexClientProvider>
      </body>
    </html>
  );
}
