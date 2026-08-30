import type { Metadata } from "next";
import "@fontsource-variable/instrument-sans";
import "@fontsource-variable/jetbrains-mono";
import "./globals.css";
import "./simple.css";

export const metadata: Metadata = {
  title: "CareFlow | Clinical operations workstation",
  description: "A fictional, client-side hospital operations MVP for portfolio demonstration.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
