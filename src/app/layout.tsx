import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import Providers from "@/app/providers";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "CricGeek - Live Cricket Scores, Analysis & Community",
  description:
    "Your ultimate cricket companion. Live match scores, ball-by-ball commentary, expert analysis, and community-driven cricket discussion.",
  keywords: ["cricket", "live scores", "IPL", "World Cup", "cricket analysis"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.className} bg-cg-dark text-white min-h-screen`}>
        <Providers>
          <Navbar />
          <main className="min-h-[calc(100vh-64px)]">{children}</main>
          <Footer />
        </Providers>
      </body>
    </html>
  );
}
