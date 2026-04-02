"use client";

import React from 'react';
import { X, Menu, Shield, Crown, Headphones } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AdminNav } from './AdminNav';

interface MobileAdminHeaderProps {
  userRole?: string;
  showMenu: boolean;
  setShowMenu: (show: boolean) => void;
}

export function MobileAdminHeader({ userRole, showMenu, setShowMenu }: MobileAdminHeaderProps) {
  return (
    <div className="lg:hidden fixed top-0 left-0 right-0 h-16 bg-gray-900/95 border-b border-gray-800 backdrop-blur-xl z-40">
      <div className="flex items-center justify-between h-full px-4">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowMenu(!showMenu)}
            className="text-gray-400 hover:text-white p-2 -ml-2"
          >
            {showMenu ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </Button>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
              <Shield className="w-4 h-4 text-white" />
            </div>
            <div className="leading-tight">
              <span className="font-bold text-sm text-white">Admin</span>
              {userRole && (
                <div className="flex items-center gap-1">
                  {userRole === 'admin' && <Crown className="w-2.5 h-2.5 text-purple-400" />}
                  {userRole === 'support' && <Headphones className="w-2.5 h-2.5 text-blue-400" />}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

interface MobileSidebarProps {
  userRole?: string;
  showMenu: boolean;
  setShowMenu: (show: boolean) => void;
}

export function MobileSidebar({ userRole, showMenu, setShowMenu }: MobileSidebarProps) {
  return (
    <>
      {/* Overlay */}
      {showMenu && (
        <div
          className="lg:hidden fixed inset-0 bg-black/70 backdrop-blur-sm z-40"
          onClick={() => setShowMenu(false)}
        />
      )}

      {/* Sidebar */}
      <div
        className={`lg:hidden fixed left-0 top-0 h-full w-72 bg-gradient-to-b from-gray-900 to-black border-r border-gray-800 z-50 overflow-y-auto transition-transform duration-300 ease-in-out ${
          showMenu ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="p-6 pt-20">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-lg shadow-blue-500/20">
              <Shield className="w-8 h-8 text-white" />
            </div>
            <h1 className="font-bold text-xl text-white">Admin Panel</h1>
            <p className="text-xs text-gray-500 mt-1">v1.0.0</p>
            {userRole && (
              <div className="inline-flex items-center gap-2 mt-3 px-3 py-1.5 bg-gray-800/50 rounded-full border border-gray-700">
                {userRole === 'admin' && <Crown className="w-3.5 h-3.5 text-purple-400" />}
                {userRole === 'support' && <Headphones className="w-3.5 h-3.5 text-blue-400" />}
                <span className="text-xs text-gray-300 uppercase font-medium">{userRole}</span>
              </div>
            )}
          </div>

          <AdminNav userRole={userRole} darkMode={true} onNavigate={() => setShowMenu(false)} />
        </div>
      </div>
    </>
  );
}
