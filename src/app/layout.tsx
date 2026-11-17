import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Grade Planner",
  description:
    "See your grade range, what you need for your target grade, and what you can afford to skip.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full">{children}</body>
    </html>
  );
}
