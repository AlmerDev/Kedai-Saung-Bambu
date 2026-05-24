import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "KEDAI SAUNG BAMBU",
  description: "QR menu, admin panel, order, dan Midtrans untuk KEDAI SAUNG BAMBU."
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  );
}
