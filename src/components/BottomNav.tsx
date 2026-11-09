/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Home, Layers, Plus, BarChart3, Brain } from 'lucide-react';
import { NavTab } from './HeaderAndDrawer';

interface BottomNavProps {
  activeTab: NavTab;
  onTabChange: (tab: NavTab) => void;
  onOpenAddModal: () => void;
}

export const BottomNav: React.FC<BottomNavProps> = ({
  activeTab,
  onTabChange,
  onOpenAddModal,
}) => {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-100 px-3 py-1 pb-safe shadow-lg">
      <div className="max-w-md mx-auto flex items-center justify-between relative">
        {/* 1. Home */}
        <button
          onClick={() => onTabChange('home')}
          className={`flex-1 flex flex-col items-center justify-center py-1 transition cursor-pointer ${
            activeTab === 'home' ? 'text-[#2563EB]' : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <Home className="w-5 h-5" />
          <span className="text-[10px] font-medium mt-1">Home</span>
        </button>

        {/* 2. Manage */}
        <button
          onClick={() => onTabChange('manage')}
          className={`flex-1 flex flex-col items-center justify-center py-1 transition cursor-pointer ${
            activeTab === 'manage' ? 'text-[#2563EB]' : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <Layers className="w-5 h-5" />
          <span className="text-[10px] font-medium mt-1">Manage</span>
        </button>

        {/* 3. Central Add Button */}
        <div className="flex-1 flex flex-col items-center justify-center">
          <button
            onClick={onOpenAddModal}
            aria-label="Add Transaction"
            className="w-12 h-12 rounded-full bg-[#2563EB] hover:bg-blue-700 active:scale-95 text-white shadow-lg shadow-blue-500/35 flex items-center justify-center transition-all cursor-pointer -translate-y-3.5 border-2 border-white"
          >
            <Plus className="w-6 h-6 stroke-[2.5]" />
          </button>
          <span className="text-[10px] font-medium text-slate-500 -mt-2.5">Add</span>
        </div>

        {/* 4. Analysis */}
        <button
          onClick={() => onTabChange('analysis')}
          className={`flex-1 flex flex-col items-center justify-center py-1 transition cursor-pointer ${
            activeTab === 'analysis' ? 'text-[#2563EB]' : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <BarChart3 className="w-5 h-5" />
          <span className="text-[10px] font-medium mt-1">Analysis</span>
        </button>

        {/* 5. AI Manager */}
        <button
          onClick={() => onTabChange('ai_manager')}
          className={`flex-1 flex flex-col items-center justify-center py-1 transition cursor-pointer ${
            activeTab === 'ai_manager' ? 'text-[#2563EB]' : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <Brain className="w-5 h-5" />
          <span className="text-[10px] font-medium mt-1">AI Manager</span>
        </button>
      </div>
    </nav>
  );
};
