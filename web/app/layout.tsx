import type { Metadata } from "next";
import { Biryani } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/app/contexts/AuthContext";
import { Providers } from './providers'
import { BalanceSyncProvider } from "@/components/BalanceSyncProvider";
import { LanguageProvider } from "@/app/contexts/LanguageContext";
import { ReferralProvider } from "@/app/contexts/ReferralContext";
import { LayoutWrapper } from "@/components/LayoutWrapper";

const biryani = Biryani({
  subsets: ['latin'],
  weight: ['200', '300', '400', '600', '700', '800', '900'],
  variable: '--font-biryani',
});

const biryaniSemiBold = Biryani({
  subsets: ['latin'],
  weight: '600',
  variable: '--font-biryani-semibold',
});

export const metadata: Metadata = {
  title: "Neura | AI Trading Signals",
  description: "Accurate trading signals based on artificial intelligence",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${biryani.variable} ${biryaniSemiBold.variable}`}>
      <body className="antialiased">
        <Providers>
          <LanguageProvider>
            <AuthProvider>
              <ReferralProvider>
                <BalanceSyncProvider>
                  <LayoutWrapper>
                    {children}
                  </LayoutWrapper>
                </BalanceSyncProvider>
              </ReferralProvider>
            </AuthProvider>
          </LanguageProvider>
        </Providers>
      </body>
    </html>
  );
}