import type { Metadata } from "next";
import Link from "next/link";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "ADSC Hackathon Leaderboard",
  description: "Gamified hackathon leaderboard and XP dashboard",
  icons: {
    icon: '/favicon.ico',
    shortcut: '/favicon.ico',
    apple: '/favicon.ico',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <div className="min-h-screen">
          <header className="sticky top-0 z-50 border-b border-border/60 bg-background/70 backdrop-blur">
            <div className="mx-auto flex min-h-16 w-full max-w-6xl flex-col items-center justify-between gap-3 px-4 py-3 sm:flex-row sm:gap-4 sm:py-0">
              <Link href="/" className="flex items-center gap-3 min-w-0">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white ring-1 ring-border">
                  <img 
                    src="/logo.png" 
                    alt="ADSC Logo" 
                    className="h-full w-full object-contain scale-[2.5]"
                  />
                </div>
                <div className="leading-tight text-center sm:text-left min-w-0">
                  <div className="text-sm font-semibold tracking-tight break-words">
                    {process.env.NEXT_PUBLIC_HACKATHON_NAME ?? "ADSC Hackathon"}
                  </div>
                  <div className="text-xs text-muted">Leaderboard</div>
                </div>
              </Link>

              <nav className="flex w-full sm:w-auto flex-wrap items-center justify-center gap-1 text-sm sm:gap-2">
                <Link
                  href="/leaderboard"
                  className="rounded-full px-3 py-2 text-muted transition-colors hover:bg-card hover:text-foreground sm:px-4 text-center"
                >
                  Leaderboard
                </Link>
                <Link
                  href="/team"
                  className="rounded-full px-3 py-2 text-muted transition-colors hover:bg-card hover:text-foreground sm:px-4 text-center"
                >
                  Team Dashboard
                </Link>
              </nav>
            </div>
          </header>

          <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:py-10">{children}</main>

          <footer className="border-t border-border/60">
            <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-2 px-4 py-6 text-xs text-muted sm:flex-row sm:py-8">
              <span>ADSC • Atmiya University</span>
              <span>Built for the hackathon</span>
            </div>
          </footer>
        </div>
      </body>
    </html>
  );
}
