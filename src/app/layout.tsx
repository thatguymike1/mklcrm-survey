import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Mike King Live Survey",
  description: "Personalized survey experience",
  icons: {
    icon: "/assets/mkl-favicon.png",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
