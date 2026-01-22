import type { Metadata } from "next";
import { Notification } from "@/components/ui/Notification";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI Typing Coach - Real-time AI-Powered Practice",
  description: "Interactive AI typing coach with personalized training plans",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <div className="container">
          {children}
        </div>
        <Notification />
      </body>
    </html>
  );
}
