import type { Metadata } from "next";
import { Biryani } from "next/font/google";
import "./globals.css";
import { Header } from "@/components/ui/shared/header";
import { Footer } from "@/components/ui/shared/footer"; // Добавьте импорт футера
import { AuthProvider } from "@/app/contexts/AuthContext";
import { Providers } from './providers'
import CookieConsent from "@/components/modals/CookieConsent";

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
  description: "Точные торговые сигналы на основе искусственного интеллекта",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru" className={`${biryani.variable} ${biryaniSemiBold.variable}`}>
      <body className="antialiased">
        <Providers>
          <div className="min-h-screen bg-gradient-to-b from-black via-gray-900 to-black">
            <Header />
            
              {children}
            
            {/* Футер добавлен в глобальный layout */}
            <CookieConsent />
            <Footer showBrand={false} /> {/* Не показываем бренд в layout, только на главной */}
            
          </div>
      
        </Providers>
      </body>
    </html>
  );
}