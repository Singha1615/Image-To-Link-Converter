import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ImageHost — Share your images",
  description: "Upload your images and share them anywhere.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
