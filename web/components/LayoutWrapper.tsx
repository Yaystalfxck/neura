"use client";

import { usePathname } from "next/navigation";
import { Header } from "@/components/ui/shared/header";
import { Footer } from "@/components/ui/shared/footer";
import CookieConsent from "@/components/modals/CookieConsent";

interface LayoutWrapperProps {
  children: React.ReactNode;
}

export function LayoutWrapper({ children }: LayoutWrapperProps) {
  const pathname = usePathname();
  const isAdminPage = pathname?.startsWith('/admin');
  
  return (
    <>
      {!isAdminPage && <Header />}
      {children}
      <CookieConsent />
      {!isAdminPage && <Footer showBrand={false} />}
    </>
  );
}
