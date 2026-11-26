import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Interior Works — Design & Material Studio",
  description: "Plan interior units, calculate materials, and make every sheet count.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
