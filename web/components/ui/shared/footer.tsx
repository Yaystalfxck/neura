// components/layout/Footer.tsx
"use client";

import React from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { useLanguage } from "@/app/contexts/LanguageContext";

interface FooterProps {
  showBrand?: boolean;
}

export const Footer: React.FC<FooterProps> = ({ showBrand = true }) => {
  const { t } = useLanguage();
  
  const footerLinks = [
    { title: t("header.partners"), href: "/partners" },
    { title: t("footer.terms"), href: "/terms" },
    { title: t("footer.privacy"), href: "/privacy" },
  ];

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      whileInView={{ opacity: 1 }}
      transition={{ duration: 0.6, delay: 0.4 }}
      viewport={{ once: true }}
      className="mt-16 pt-8 border-t border-white/10 relative z-10"
    >
      {showBrand && (
        <motion.h3 
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.5 }}
          viewport={{ once: true }}
          className="text-2xl font-bold mb-8"
        >
          Neura
        </motion.h3>
      )}
      
      <div className="flex flex-col md:flex-row justify-center items-center gap-6 md:gap-12 text-gray-400">
        {footerLinks.map((link, index) => (
          <motion.div
            key={link.title}
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.6 + index * 0.1 }}
            viewport={{ once: true }}
            whileHover={{ scale: 1.05 }}
          >
            <Link 
              href={link.href} 
              className="hover:text-white transition-colors"
            >
              {link.title}
            </Link>
          </motion.div>
        ))}
      </div>
      
      <motion.p
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        transition={{ duration: 0.6, delay: 0.9 }}
        viewport={{ once: true }}
        className="mt-8 text-gray-500 text-sm text-center"
      >
        © {new Date().getFullYear()} {t("footer.brand")}. {t("footer.allRightsReserved")}
      </motion.p>
    </motion.div>
  );
};