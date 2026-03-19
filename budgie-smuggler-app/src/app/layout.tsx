import type { Metadata } from "next";
import { Space_Grotesk, IBM_Plex_Mono } from "next/font/google";
import { APP_NAME } from "@/lib/constants";
import { PwaRegister } from "@/components/layout/pwa-register";
import "./globals.css";

const fontSans = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-sans",
});

const fontMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-mono",
});

export const metadata: Metadata = {
  title: APP_NAME,
  description: "Private budgeting app with bank sync, alerts, and personalized insights.",
  applicationName: APP_NAME,
  icons: {
    icon: [
      { url: "/icon-192.png", type: "image/png", sizes: "192x192" },
      { url: "/icon-512.png", type: "image/png", sizes: "512x512" },
    ],
    shortcut: [{ url: "/icon-192.png", type: "image/png", sizes: "192x192" }],
    apple: [{ url: "/icon-192.png", type: "image/png", sizes: "192x192" }],
  },
  appleWebApp: {
    capable: true,
    title: APP_NAME,
    statusBarStyle: "default",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${fontSans.variable} ${fontMono.variable} font-sans antialiased`}>
        <div className="bg-[var(--paper)]">
          <PwaRegister />
          {children}
          <footer className="px-4 pb-6 text-center text-xs text-neutral-500 md:px-6">
            Budgie icons created by{" "}
            <a
              href="https://www.flaticon.com/free-icons/budgie"
              title="budgie icons"
              className="underline hover:text-neutral-700"
              target="_blank"
              rel="noreferrer"
            >
              Park Jisun - Flaticon
            </a>
          </footer>
        </div>
      </body>
    </html>
  );
}
