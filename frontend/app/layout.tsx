import type { Metadata } from "next";
import localFont from "next/font/local";
import { SessionGuard } from "@/components/shared/SessionGuard";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

const themeBootstrap = `(()=>{let preference="system";try{preference=localStorage.getItem("elevra-theme")||localStorage.getItem("elevra-student-theme")||"system"}catch{}const dark=preference==="dark"||(preference!=="light"&&window.matchMedia("(prefers-color-scheme: dark)").matches);const root=document.documentElement;root.classList.toggle("dark",dark);root.classList.toggle("light",preference==="light");root.style.colorScheme=dark?"dark":"light"})();`;

export const metadata: Metadata = {
  title: "Elevra.ai | Student Success Intelligence",
  description: "Early-warning and student success analytics for campuses.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootstrap }} />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <SessionGuard />
        {children}
        <Toaster richColors />
      </body>
    </html>
  );
}
