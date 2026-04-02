"use client";

import React, { useState } from 'react';
import { X, Shield, User, Crown, Headphones } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Role {
  id: string;
  label: string;
  description: string;
  icon: React.ElementType;
  color: string;
}

interface RoleSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (role: string) => void;
  currentRole: string;
}

const roles: Role[] = [
  {
    id: 'user',
    label: 'User',
    description: 'Обычный пользователь. Доступ к личному кабинету и поддержке.',
    icon: User,
    color: 'from-gray-500 to-gray-600'
  },
  {
    id: 'support',
    label: 'Support',
    description: 'Поддержка. Доступ к тикетам пользователей и ответы на вопросы.',
    icon: Headphones,
    color: 'from-blue-500 to-blue-600'
  },
  {
    id: 'admin',
    label: 'Admin',
    description: 'Администратор. Полный доступ ко всем разделам панели управления.',
    icon: Crown,
    color: 'from-purple-500 to-purple-600'
  }
];

export function RoleSelectorModal({ isOpen, onClose, onSelect, currentRole }: RoleSelectorModalProps) {
  const [selectedRole, setSelectedRole] = useState(currentRole);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="relative w-full max-w-2xl bg-gradient-to-b from-gray-900 to-black border border-gray-800 rounded-2xl p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-purple-900/30 rounded-xl">
              <Shield className="w-6 h-6 text-purple-400" />
            </div>
            <div>
              <h2 className="text-2xl font-bold">Выбор роли</h2>
              <p className="text-sm text-gray-400">Выберите роль для пользователя</p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="w-5 h-5" />
          </Button>
        </div>

        <div className="grid gap-4 mb-6">
          {roles.map((role) => {
            const Icon = role.icon;
            const isSelected = selectedRole === role.id;
            
            return (
              <div
                key={role.id}
                onClick={() => setSelectedRole(role.id)}
                className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
                  isSelected
                    ? 'border-purple-500 bg-purple-900/20'
                    : 'border-gray-700 bg-gray-800/30 hover:border-gray-600'
                }`}
              >
                <div className="flex items-start gap-4">
                  <div className={`p-3 rounded-xl bg-gradient-to-br ${role.color}`}>
                    <Icon className="w-5 h-5 text-white" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-bold text-lg">{role.label}</h3>
                      {isSelected && (
                        <span className="px-2 py-0.5 bg-purple-500 text-white text-xs rounded-full">
                          Выбрано
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-400">{role.description}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={onClose}
            className="flex-1 border-gray-700 hover:border-gray-500"
          >
            Отмена
          </Button>
          <Button
            onClick={() => {
              onSelect(selectedRole);
              onClose();
            }}
            className="flex-1 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
          >
            <Shield className="w-4 h-4 mr-2" />
            Применить
          </Button>
        </div>
      </div>
    </div>
  );
}
