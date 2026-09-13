import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Watch Party",
  description: "Watch a movie together in sync, with camera and microphone.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
