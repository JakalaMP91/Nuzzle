import type { Metadata, Viewport } from "next";
import "./globals.css";
import "./nuzzle-theme.css";

export const metadata: Metadata = {
  title: "Nuzzle – gemeinsam kochen und planen",
  description: "Gemeinsam Rezepte sammeln, einkaufen und den Alltag organisieren.",
  appleWebApp: { capable: true, title: "Nuzzle", statusBarStyle: "default" },
icons: {
    icon: "/favicon.svg?v=nuzzle-green-1",
    shortcut: "/favicon.svg?v=nuzzle-green-1",
    apple: "/nuzzle-icon-180.png?v=nuzzle-green-1",
  },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, maximumScale: 1, userScalable: false, themeColor: "#f5f8f4" };

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="de">
      <head><link rel="manifest" href="/manifest.webmanifest?v=nuzzle-green-1" crossOrigin="use-credentials" /></head>
      <body className="antialiased">{children}</body>
    </html>
  );
}
