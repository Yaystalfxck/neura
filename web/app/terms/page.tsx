// app/terms/page.tsx
"use client";

import React from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Shield, FileText, AlertTriangle, CheckCircle, XCircle, Zap, Users, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { useLanguage } from "@/app/contexts/LanguageContext";

export default function TermsPage() {
  const { t } = useLanguage();
  return (
    <div className="min-h-screen bg-gradient-to-b from-black via-gray-900 to-black text-white">
      {/* Animated Background Elements */}
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.3 }}
        transition={{ duration: 2 }}
        className="fixed top-20 left-10 w-72 h-72 bg-blue-500/10 rounded-full blur-3xl -z-10"
      />
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.2 }}
        transition={{ duration: 2, delay: 0.5 }}
        className="fixed bottom-20 right-10 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl -z-10"
      />


      {/* Main Content */}
      <main className="container mx-auto px-4 py-12 max-w-4xl">
        {/* Hero Section */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ duration: 0.5, type: "spring" }}
            className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-blue-500/20 to-purple-500/20 border border-blue-500/30 mb-6"
          >
            <Shield className="w-8 h-8 text-blue-400" />
          </motion.div>
          
          <motion.h1
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="text-4xl md:text-5xl font-bold mb-4 bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-300"
          >
            {t("terms.title")}
          </motion.h1>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="text-xl text-gray-400 max-w-2xl mx-auto"
          >
            {t("terms.subtitle")}
          </motion.p>
        </motion.div>

        {/* Content Sections */}
        <div className="space-y-12">
          {/* Section 1 */}
          <motion.section
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="bg-gray-900/30 backdrop-blur-sm border border-gray-800 rounded-2xl p-8 hover:border-blue-500/30 transition-colors"
          >
            <motion.div
              whileHover={{ scale: 1.05 }}
              className="flex items-center gap-4 mb-6"
            >
              <div className="p-3 rounded-xl bg-gradient-to-br from-red-500/20 to-red-600/20 border border-red-500/30">
                <AlertTriangle className="w-6 h-6 text-red-400" />
              </div>
              <h2 className="text-2xl font-bold">{t("terms.section1Title")}</h2>
            </motion.div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.5 }}
              className="space-y-4 text-gray-300"
            >
              <p>
                {t("terms.generalDesc")}
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
                <motion.div
                  whileHover={{ y: -5 }}
                  className="p-4 rounded-lg bg-gray-900/50 border border-gray-800"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle className="w-5 h-5 text-green-400" />
                    <span className="font-semibold">{t("terms.allowed")}</span>
                  </div>
                  <ul className="space-y-2 text-sm text-gray-400">
                    {t("terms.allowedItems").split(', ').map((item, i) => (
                      <li key={i}>• {item}</li>
                    ))}
                  </ul>
                </motion.div>

                <motion.div
                  whileHover={{ y: -5 }}
                  className="p-4 rounded-lg bg-gray-900/50 border border-gray-800"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <XCircle className="w-5 h-5 text-red-400" />
                    <span className="font-semibold">{t("terms.prohibited")}</span>
                  </div>
                  <ul className="space-y-2 text-sm text-gray-400">
                    {t("terms.prohibitedItems").split(', ').map((item, i) => (
                      <li key={i}>• {item}</li>
                    ))}
                  </ul>
                </motion.div>
              </div>
            </motion.div>
          </motion.section>

          {/* Section 2 */}
          <motion.section
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.5 }}
            className="bg-gray-900/30 backdrop-blur-sm border border-gray-800 rounded-2xl p-8 hover:border-purple-500/30 transition-colors"
          >
            <motion.div
              whileHover={{ scale: 1.05 }}
              className="flex items-center gap-4 mb-6"
            >
              <div className="p-3 rounded-xl bg-gradient-to-br from-purple-500/20 to-purple-600/20 border border-purple-500/30">
                <Zap className="w-6 h-6 text-purple-400" />
              </div>
              <h2 className="text-2xl font-bold">{t("terms.section2Title")}</h2>
            </motion.div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.6 }}
              className="space-y-6 text-gray-300"
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <motion.div
                  whileHover={{ scale: 1.02 }}
                  className="p-4 rounded-lg bg-gray-900/50 border border-gray-800"
                >
                  <h3 className="font-semibold mb-3 flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-green-500"></div>
                    {t("terms.requirements")}
                  </h3>
                  <ul className="space-y-2 text-sm text-gray-400">
                    {t("terms.requirementsItems").split(', ').map((item, i) => (
                      <li key={i}>• {item}</li>
                    ))}
                  </ul>
                </motion.div>

                <motion.div
                  whileHover={{ scale: 1.02 }}
                  className="p-4 rounded-lg bg-gray-900/50 border border-gray-800"
                >
                  <h3 className="font-semibold mb-3 flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                    {t("terms.restrictions")}
                  </h3>
                  <ul className="space-y-2 text-sm text-gray-400">
                    {t("terms.restrictionsItems").split(', ').map((item, i) => (
                      <li key={i}>• {item}</li>
                    ))}
                  </ul>
                </motion.div>
              </div>
            </motion.div>
          </motion.section>

          {/* Section 3 */}
          <motion.section
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.6 }}
            className="bg-gray-900/30 backdrop-blur-sm border border-gray-800 rounded-2xl p-8 hover:border-green-500/30 transition-colors"
          >
            <motion.div
              whileHover={{ scale: 1.05 }}
              className="flex items-center gap-4 mb-6"
            >
              <div className="p-3 rounded-xl bg-gradient-to-br from-green-500/20 to-green-600/20 border border-green-500/30">
                <Users className="w-6 h-6 text-green-400" />
              </div>
              <h2 className="text-2xl font-bold">{t("terms.section3Title")}</h2>
            </motion.div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.7 }}
              className="space-y-4 text-gray-300"
            >
              <p>
                {t("terms.responsibilityDesc")}
              </p>

              <motion.div
                animate={{
                  boxShadow: [
                    "0 0 0px rgba(239, 68, 68, 0)",
                    "0 0 20px rgba(239, 68, 68, 0.3)",
                    "0 0 0px rgba(239, 68, 68, 0)"
                  ]
                }}
                transition={{ repeat: Infinity, duration: 3 }}
                className="p-4 rounded-lg bg-red-900/20 border border-red-800/50 mt-6"
              >
                <h4 className="font-semibold text-red-300 mb-2">{t("terms.warning")}</h4>
                <p className="text-sm text-red-200/80">
                  {t("terms.warningDesc")}
                </p>
              </motion.div>
            </motion.div>
          </motion.section>

          {/* Section 4 */}
          <motion.section
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.7 }}
            className="bg-gray-900/30 backdrop-blur-sm border border-gray-800 rounded-2xl p-8 hover:border-yellow-500/30 transition-colors"
          >
            <motion.div
              whileHover={{ scale: 1.05 }}
              className="flex items-center gap-4 mb-6"
            >
              <div className="p-3 rounded-xl bg-gradient-to-br from-yellow-500/20 to-yellow-600/20 border border-yellow-500/30">
                <Lock className="w-6 h-6 text-yellow-400" />
              </div>
              <h2 className="text-2xl font-bold">{t("terms.section4Title")}</h2>
            </motion.div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.8 }}
              className="space-y-4 text-gray-300"
            >
              <p>
                {t("terms.privacyDesc")}
              </p>

              <motion.div
                whileHover={{ scale: 1.02 }}
                className="flex items-center justify-between p-4 rounded-lg bg-gray-900/50 border border-gray-800 mt-6"
              >
                <div>
                  <h4 className="font-semibold">{t("terms.privacyPolicy")}</h4>
                  <p className="text-sm text-gray-400 mt-1">{t("terms.learnMore")}</p>
                </div>
                <motion.div
                  whileHover={{ x: 5 }}
                  transition={{ duration: 0.2 }}
                >
                  <Link href="/privacy">
                    <Button
                      variant="outline"
                      className="border-gray-700 hover:border-blue-500 hover:bg-blue-900/20"
                    >
                      {t("terms.learnMore")}
                    </Button>
                  </Link>
                </motion.div>
              </motion.div>
            </motion.div>
          </motion.section>
        </div>

        {/* Acceptance Button */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.9 }}
          className="mt-16 text-center"
        >
          <motion.p
            animate={{ opacity: [0.7, 1, 0.7] }}
            transition={{ repeat: Infinity, duration: 2 }}
            className="text-gray-400 mb-6"
          >
            {t("terms.continueUsing")}
          </motion.p>

          <motion.div
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <Link href="/">
              <Button
                size="lg"
                className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 px-12 py-6 rounded-xl"
              >
                {t("terms.backToHome")}
              </Button>
            </Link>
          </motion.div>
        </motion.div>
      </main>

    
    </div>
  );
}