import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Nest – gemeinsam kochen und planen",
  description: "Gemeinsam Rezepte sammeln, einkaufen und den Alltag organisieren.",
  appleWebApp: { capable: true, title: "Nest", statusBarStyle: "default" },
icons: {
    icon: "/favicon.svg?v=house-heart",
    shortcut: "/favicon.svg?v=house-heart",
  },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, maximumScale: 1, userScalable: false };

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="de">
      <head><link rel="manifest" href="/manifest.webmanifest?v=house-heart" crossOrigin="use-credentials" /></head>
      <body className="antialiased">{children}</body>
    </html>
  );
}
