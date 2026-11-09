/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import * as LucideIcons from 'lucide-react';
import { Search, X, Check } from 'lucide-react';

export const POPULAR_FINANCE_ICONS: { name: string; category: string }[] = [
  // Banking & Accounts
  { name: 'Landmark', category: 'Banking' },
  { name: 'Building2', category: 'Banking' },
  { name: 'CreditCard', category: 'Banking' },
  { name: 'Wallet', category: 'Banking' },
  { name: 'Banknote', category: 'Banking' },
  { name: 'Coins', category: 'Banking' },
  { name: 'PiggyBank', category: 'Banking' },
  { name: 'Scale', category: 'Banking' },
  { name: 'Receipt', category: 'Banking' },
  { name: 'CircleDollarSign', category: 'Banking' },

  // Daily & Living
  { name: 'Utensils', category: 'Living' },
  { name: 'Coffee', category: 'Living' },
  { name: 'ShoppingCart', category: 'Living' },
  { name: 'ShoppingBag', category: 'Living' },
  { name: 'Car', category: 'Living' },
  { name: 'Fuel', category: 'Living' },
  { name: 'Home', category: 'Living' },
  { name: 'HeartPulse', category: 'Living' },
  { name: 'Shield', category: 'Living' },
  { name: 'Zap', category: 'Living' },

  // Work & Technology
  { name: 'Briefcase', category: 'Work' },
  { name: 'Laptop', category: 'Work' },
  { name: 'TrendingUp', category: 'Work' },
  { name: 'Smartphone', category: 'Work' },
  { name: 'Tv', category: 'Work' },
  { name: 'Wifi', category: 'Work' },
  { name: 'Phone', category: 'Work' },
  { name: 'Mail', category: 'Work' },
  { name: 'Globe', category: 'Work' },

  // Lifestyle & Leisure
  { name: 'Plane', category: 'Leisure' },
  { name: 'Film', category: 'Leisure' },
  { name: 'Gamepad2', category: 'Leisure' },
  { name: 'Dumbbell', category: 'Leisure' },
  { name: 'Music', category: 'Leisure' },
  { name: 'Shirt', category: 'Leisure' },
  { name: 'Sparkles', category: 'Leisure' },
  { name: 'Smile', category: 'Leisure' },
  { name: 'Gift', category: 'Leisure' },

  // Essentials & Miscellaneous
  { name: 'Tag', category: 'Misc' },
  { name: 'GraduationCap', category: 'Misc' },
  { name: 'Repeat', category: 'Misc' },
  { name: 'BookOpen', category: 'Misc' },
  { name: 'Wrench', category: 'Misc' },
  { name: 'Truck', category: 'Misc' },
  { name: 'Scissors', category: 'Misc' },
  { name: 'Award', category: 'Misc' },
  { name: 'PlusCircle', category: 'Misc' },
];

export const PRESET_COLORS: string[] = [
  '#2563EB', // Blue
  '#4F46E5', // Indigo
  '#7C3AED', // Violet
  '#9333EA', // Purple
  '#DB2777', // Pink
  '#E11D48', // Rose
  '#DC2626', // Red
  '#EA580C', // Orange
  '#D97706', // Amber
  '#CA8A04', // Yellow
  '#059669', // Emerald
  '#16A34A', // Green
  '#0D9488', // Teal
  '#0891B2', // Cyan
  '#475569', // Slate
  '#0F172A', // Navy
];

/**
 * Dynamically renders a Lucide Icon by name with fallback
 */
export const DynamicIcon: React.FC<{
  name?: string;
  className?: string;
  style?: React.CSSProperties;
}> = ({ name = 'Tag', className = 'w-4 h-4', style }) => {
  const IconComponent = (LucideIcons as any)[name] || LucideIcons.Tag;
  return <IconComponent className={className} style={style} />;
};

interface IconPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedIcon: string;
  onSelectIcon: (iconName: string) => void;
  previewColor?: string;
}

export const IconPickerModal: React.FC<IconPickerModalProps> = ({
  isOpen,
  onClose,
  selectedIcon,
  onSelectIcon,
  previewColor = '#2563EB',
}) => {
  const [search, setSearch] = useState('');
  const [selectedFilter, setSelectedFilter] = useState<string>('All');

  if (!isOpen) return null;

  const filteredIcons = POPULAR_FINANCE_ICONS.filter((item) => {
    if (selectedFilter !== 'All' && item.category !== selectedFilter) return false;
    if (search.trim()) {
      return item.name.toLowerCase().includes(search.toLowerCase());
    }
    return true;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-2xs animate-in fade-in">
      <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-md p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4 max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center text-white shadow-xs"
              style={{ backgroundColor: previewColor }}
            >
              <DynamicIcon name={selectedIcon} className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-slate-900 dark:text-slate-100">
                Choose Icon
              </h3>
              <p className="text-[11px] text-slate-500">
                Selected: <span className="font-bold text-slate-700 dark:text-slate-300">{selectedIcon}</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search icons (e.g. food, bank, card, shopping)..."
            className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-500"
          />
        </div>

        {/* Categories Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-[11px] font-semibold text-slate-600 dark:text-slate-300">
          {['All', 'Banking', 'Living', 'Work', 'Leisure', 'Misc'].map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedFilter(cat)}
              className={`px-2.5 py-1 rounded-lg transition whitespace-nowrap cursor-pointer ${
                selectedFilter === cat
                  ? 'bg-[#0B1528] text-white shadow-xs'
                  : 'bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Icon Grid */}
        <div className="grid grid-cols-5 sm:grid-cols-6 gap-2.5 overflow-y-auto pr-1 flex-1 py-1 max-h-64">
          {filteredIcons.map((item) => {
            const isSelected = selectedIcon === item.name;
            return (
              <button
                key={item.name}
                onClick={() => {
                  onSelectIcon(item.name);
                  onClose();
                }}
                className={`p-3 rounded-xl flex flex-col items-center justify-center gap-1 border transition cursor-pointer group ${
                  isSelected
                    ? 'border-blue-600 bg-blue-50 dark:bg-blue-950/40 text-blue-600'
                    : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/80 hover:border-slate-300 text-slate-700 dark:text-slate-300'
                }`}
                title={item.name}
              >
                <DynamicIcon
                  name={item.name}
                  className="w-5 h-5 group-hover:scale-110 transition-transform"
                />
                <span className="text-[9px] font-medium truncate w-full text-center">
                  {item.name}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

interface ColorPickerProps {
  selectedColor: string;
  onChangeColor: (color: string) => void;
  label?: string;
}

export const ColorPicker: React.FC<ColorPickerProps> = ({
  selectedColor,
  onChangeColor,
  label = 'Select Color',
}) => {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-xs font-bold text-slate-700 dark:text-slate-300">{label}</label>
        <div className="flex items-center gap-1.5">
          <div
            className="w-4 h-4 rounded-full border border-slate-300 shadow-2xs"
            style={{ backgroundColor: selectedColor }}
          />
          <span className="text-[11px] font-mono font-bold text-slate-600 dark:text-slate-400">
            {selectedColor.toUpperCase()}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-8 gap-2">
        {PRESET_COLORS.map((color) => {
          const isSelected = selectedColor.toLowerCase() === color.toLowerCase();
          return (
            <button
              key={color}
              type="button"
              onClick={() => onChangeColor(color)}
              className="w-8 h-8 rounded-xl flex items-center justify-center transition cursor-pointer shadow-2xs active:scale-95 border-2 relative"
              style={{
                backgroundColor: color,
                borderColor: isSelected ? '#FFFFFF' : 'transparent',
              }}
            >
              {isSelected && <Check className="w-4 h-4 text-white drop-shadow-md stroke-[3]" />}
            </button>
          );
        })}
      </div>
    </div>
  );
};
