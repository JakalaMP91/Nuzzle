import type { Metadata, Viewport } from "next";
import "./globals.css";
import "./nuzzle-theme.css";
import { NuzzleThemeProvider } from "@/components/nuzzle-theme";

export const metadata: Metadata = {
  title: "Nuzzle – gemeinsam kochen und planen",
  description: "Gemeinsam Rezepte sammeln, einkaufen und den Alltag organisieren.",
  appleWebApp: { capable: true, title: "Nuzzle", statusBarStyle: "default" },
icons: {
    icon: "/nuzzle-icon-violet.svg?v=1",
    shortcut: "/nuzzle-icon-violet.svg?v=1",
    apple: "/nuzzle-icon-full-180.png?v=2",
  },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, maximumScale: 1, userScalable: false, themeColor: "#21194d" };

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="de" data-nuzzle-theme="classic">
      <head><link rel="manifest" href="/manifest.webmanifest?v=2" crossOrigin="use-credentials" /></head>
      <body className="antialiased"><NuzzleThemeProvider>{children}</NuzzleThemeProvider></body>
    </html>
  );
}
