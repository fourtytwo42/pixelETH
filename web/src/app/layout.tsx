import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Header from "@/components/Header";
import SessionProvider from "@/components/SessionProvider";
import SuspendedBanner from "@/components/SuspendedBanner";
import Web3Provider from "@/components/Web3Provider";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "PixelETH - Crypto Pixel Game",
  description: "A decentralized pixel art game on the blockchain",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        {/* Attempt to sync session from other tabs/windows when opened via verification link */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                const bc = new BroadcastChannel('auth');
                bc.postMessage({ type: 'request-state' });
                bc.onmessage = (ev) => {
                  if (ev.data && ev.data.type === 'state') {
                    if (ev.data.refreshToken) localStorage.setItem('auth.refreshToken', ev.data.refreshToken);
                    if (ev.data.user) localStorage.setItem('auth.user', JSON.stringify(ev.data.user));
                    try { new BroadcastChannel('auth').postMessage({ type: 'profile' }); } catch {}
                  }
                };
                setTimeout(() => { try { bc.close(); } catch (e) {} }, 5000);
              } catch {}
            `,
          }}
        />
        <SessionProvider>
          <Web3Provider>
            <SuspendedBanner />
            <Header />
            {children}
          </Web3Provider>
        </SessionProvider>
      </body>
    </html>
  );
}
