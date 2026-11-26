import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Sage & Salt — Seasonal Kitchen",
  description: "Season-led dishes, locally sourced and made for sharing.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
