// app/privacy/page.tsx
"use client";

import React from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Lock, Shield, Database, Eye, EyeOff, Server, Key, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { useLanguage } from "@/app/contexts/LanguageContext";

export default function PrivacyPage() {
  const { t } = useLanguage();
  return (
    <div className="min-h-screen bg-gradient-to-b from-black via-gray-900 to-black text-white">
      {/* Animated Background Elements */}
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.3 }}
        transition={{ duration: 2 }}
        className="fixed top-20 right-10 w-72 h-72 bg-green-500/10 rounded-full blur-3xl -z-10"
      />
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.2 }}
        transition={{ duration: 2, delay: 0.5 }}
        className="fixed bottom-20 left-10 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl -z-10"
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
            initial={{ rotate: -180, scale: 0 }}
            animate={{ rotate: 0, scale: 1 }}
            transition={{ duration: 0.7, type: "spring" }}
            className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-green-500/20 to-cyan-500/20 border border-green-500/30 mb-6"
          >
            <Lock className="w-8 h-8 text-green-400" />
          </motion.div>
          
          <motion.h1
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="text-4xl md:text-5xl font-bold mb-4 bg-clip-text text-transparent bg-gradient-to-r from-white to-green-200"
          >
            {t("privacy.title")}
          </motion.h1>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="text-xl text-gray-400 max-w-2xl mx-auto"
          >
            {t("privacy.subtitle")}
          </motion.p>
        </motion.div>

        {/* Content Sections */}
        <div className="space-y-12">
          {/* Section 1 */}
          <motion.section
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="bg-gray-900/30 backdrop-blur-sm border border-gray-800 rounded-2xl p-8 hover:border-green-500/30 transition-colors"
          >
            <motion.div
              whileHover={{ scale: 1.05 }}
              className="flex items-center gap-4 mb-6"
            >
              <div className="p-3 rounded-xl bg-gradient-to-br from-blue-500/20 to-blue-600/20 border border-blue-500/30">
                <Database className="w-6 h-6 text-blue-400" />
              </div>
              <h2 className="text-2xl font-bold">{t("privacy.section1Title")}</h2>
            </motion.div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.5 }}
              className="space-y-6"
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <motion.div
                  whileHover={{ y: -5 }}
                  className="p-4 rounded-lg bg-gray-900/50 border border-gray-800"
                >
                  <div className="flex items-center gap-2 mb-4">
                    <Eye className="w-5 h-5 text-green-400" />
                    <h3 className="font-semibold">{t("privacy.basicData")}</h3>
                  </div>
                  <ul className="space-y-2 text-sm text-gray-400">
                    {t("privacy.basicDataItems").split(', ').map((item, i) => (
                      <li key={i}>• {item}</li>
                    ))}
                  </ul>
                </motion.div>

                <motion.div
                  whileHover={{ y: -5 }}
                  className="p-4 rounded-lg bg-gray-900/50 border border-gray-800"
                >
                  <div className="flex items-center gap-2 mb-4">
                    <EyeOff className="w-5 h-5 text-red-400" />
                    <h3 className="font-semibold">{t("privacy.notCollect")}</h3>
                  </div>
                  <ul className="space-y-2 text-sm text-gray-400">
                    {t("privacy.notCollectItems").split(', ').map((item, i) => (
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
            className="bg-gray-900/30 backdrop-blur-sm border border-gray-800 rounded-2xl p-8 hover:border-cyan-500/30 transition-colors"
          >
            <motion.div
              whileHover={{ scale: 1.05 }}
              className="flex items-center gap-4 mb-6"
            >
              <div className="p-3 rounded-xl bg-gradient-to-br from-cyan-500/20 to-cyan-600/20 border border-cyan-500/30">
                <Server className="w-6 h-6 text-cyan-400" />
              </div>
              <h2 className="text-2xl font-bold">{t("privacy.section2Title")}</h2>
            </motion.div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.6 }}
              className="space-y-4 text-gray-300"
            >
              <p>
                {t("privacy.protectionDesc")}
              </p>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
                {[
                  { icon: Key, title: t("privacy.encryption"), desc: t("privacy.encryptionDesc"), color: "green" },
                  { icon: Shield, title: t("privacy.protection"), desc: t("privacy.protectionDesc2"), color: "blue" },
                  { icon: Lock, title: t("privacy.access"), desc: t("privacy.accessDesc"), color: "purple" },
                ].map((item, index) => (
                  <motion.div
                    key={item.title}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.5, delay: 0.7 + index * 0.1 }}
                    whileHover={{ scale: 1.05 }}
                    className="p-4 rounded-lg bg-gray-900/50 border border-gray-800 text-center"
                  >
                    <div className={`inline-flex items-center justify-center w-12 h-12 rounded-full bg-gradient-to-br from-${item.color}-500/20 to-${item.color}-600/20 border border-${item.color}-500/30 mb-3`}>
                      <item.icon className={`w-6 h-6 text-${item.color}-400`} />
                    </div>
                    <h3 className="font-semibold mb-2">{item.title}</h3>
                    <p className="text-sm text-gray-400">{item.desc}</p>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          </motion.section>

          {/* Section 3 */}
          <motion.section
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.6 }}
            className="bg-gray-900/30 backdrop-blur-sm border border-gray-800 rounded-2xl p-8 hover:border-yellow-500/30 transition-colors"
          >
            <motion.div
              whileHover={{ scale: 1.05 }}
              className="flex items-center gap-4 mb-6"
            >
              <div className="p-3 rounded-xl bg-gradient-to-br from-yellow-500/20 to-yellow-600/20 border border-yellow-500/30">
                <Download className="w-6 h-6 text-yellow-400" />
              </div>
              <h2 className="text-2xl font-bold">{t("privacy.section3Title")}</h2>
            </motion.div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.7 }}
              className="space-y-4 text-gray-300"
            >
              <p>
                {t("privacy.rightsDesc")}
              </p>

              <motion.div
                animate={{
                  x: [0, 5, 0],
                  transition: { repeat: Infinity, duration: 2 }
                }}
                className="p-4 rounded-lg bg-green-900/20 border border-green-800/50 mt-6"
              >
                <h4 className="font-semibold text-green-300 mb-2">{t("privacy.youCan")}</h4>
                <ul className="space-y-2 text-sm text-green-200/80">
                  <li>• {t("privacy.requestAccess")}</li>
                  <li>• {t("privacy.correctData")}</li>
                  <li>• {t("privacy.deleteAccount")}</li>
                  <li>• {t("privacy.withdrawConsent")}</li>
                </ul>
              </motion.div>
            </motion.div>
          </motion.section>

          {/* Section 4 */}
          <motion.section
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.7 }}
            className="bg-gray-900/30 backdrop-blur-sm border border-gray-800 rounded-2xl p-8 hover:border-purple-500/30 transition-colors"
          >
            <motion.div
              whileHover={{ scale: 1.05 }}
              className="flex items-center gap-4 mb-6"
            >
              <div className="p-3 rounded-xl bg-gradient-to-br from-purple-500/20 to-purple-600/20 border border-purple-500/30">
                <Shield className="w-6 h-6 text-purple-400" />
              </div>
              <h2 className="text-2xl font-bold">{t("privacy.section4Title")}</h2>
            </motion.div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.8 }}
              className="space-y-4 text-gray-300"
            >
              <p>
                {t("privacy.consentDesc")}
              </p>

              <motion.div
                whileHover={{ scale: 1.02 }}
                className="p-4 rounded-lg bg-gray-900/50 border border-gray-800 mt-6"
              >
                <h4 className="font-semibold mb-2">{t("privacy.contactsTitle")}</h4>
                <p className="text-sm text-gray-400 mb-3">
                  {t("privacy.contactsDesc")}
                </p>
                <div className="flex flex-col sm:flex-row gap-4">
                  <Link href="/terms">
                    <Button
                      variant="outline"
                      className="w-full sm:w-auto border-gray-700 hover:border-blue-500 hover:bg-blue-900/20"
                    >
                      {t("privacy.termsOfUse")}
                    </Button>
                  </Link>
                  <Link href="/">
                    <Button
                      variant="outline"
                      className="w-full sm:w-auto border-gray-700 hover:border-green-500 hover:bg-green-900/20"
                    >
                      {t("privacy.home")}
                    </Button>
                  </Link>
                </div>
              </motion.div>
            </motion.div>
          </motion.section>
        </div>

        {/* Security Badge */}
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.9, type: "spring" }}
          className="mt-16 p-6 rounded-2xl bg-gradient-to-r from-green-900/20 to-cyan-900/20 border border-green-800/30 text-center"
        >
          <motion.div
            animate={{ 
              boxShadow: [
                "0 0 0px rgba(34, 197, 94, 0)",
                "0 0 30px rgba(34, 197, 94, 0.4)",
                "0 0 0px rgba(34, 197, 94, 0)"
              ]
            }}
            transition={{ repeat: Infinity, duration: 3 }}
            className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-green-500/30 to-green-600/30 border border-green-500/50 mb-4"
          >
            <Shield className="w-8 h-8 text-green-400" />
          </motion.div>
          
          <h3 className="text-xl font-bold mb-2 text-green-300">{t("privacy.dataProtected")}</h3>
          <p className="text-gray-400">
            {t("privacy.dataProtectedDesc")}
          </p>
        </motion.div>
      </main>

      
    </div>
  );
}