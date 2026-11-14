/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  Plus,
  ArrowDownLeft,
  ArrowUpRight,
  ArrowRightLeft,
  Filter,
  RotateCcw,
  Pencil,
  Trash2,
  CheckCircle2,
  Layers,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Star,
  X,
} from 'lucide-react';
import { Account, Transaction, UserProfile, TransactionType } from '../types/finance';
import { convertCurrency, formatCurrency, getCachedRates } from '../services/currencyService';
import { CalculationService, DateFilterOptions } from '../services/calculationService';
import { DynamicIcon } from './IconAndColorPicker';
import { CategoryItem } from '../services/storageService';
import { EditTransactionModal } from './EditTransactionModal';

interface HomeScreenProps {
  profile: UserProfile;
  accounts: Account[];
  transactions: Transaction[];
  categories: CategoryItem[];
  onOpenAddModal: () => void;
  onOpenCreateAccount: () => void;
  onNavigateManage: () => void;
  onUpdateTransaction: (tx: Transaction) => Promise<boolean | void> | void;
  onDeleteTransaction: (id: string) => Promise<boolean | void> | void;
  onReorderAccounts?: (reorderedAccounts: Account[]) => Promise<boolean | void> | void;
}

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

export const HomeScreen: React.FC<HomeScreenProps> = ({
  profile,
  accounts,
  transactions,
  categories,
  onOpenAddModal,
  onOpenCreateAccount,
  onNavigateManage: _onNavigateManage,
  onUpdateTransaction,
  onDeleteTransaction,
  onReorderAccounts,
}) => {
  const prefCurrency = profile.preferredCurrency;
  const rates = getCachedRates().rates;

  // Requirement 7: By default, select the first active account. If none, 'all'
  const [selectedAccountId, setSelectedAccountId] = useState<string | 'all'>(() => {
    return accounts.length > 0 ? accounts[0].id : 'all';
  });

  // Ensure selectedAccountId stays valid when accounts change
  useEffect(() => {
    if (selectedAccountId !== 'all') {
      const exists = accounts.some((a) => a.id === selectedAccountId);
      if (!exists && accounts.length > 0) {
        setSelectedAccountId(accounts[0].id);
      } else if (accounts.length === 0) {
        setSelectedAccountId('all');
      }
    } else if (accounts.length > 0 && selectedAccountId === 'all') {
      // Keep 'all' if user explicitly picked 'all'
    }
  }, [accounts, selectedAccountId]);

  // Requirement 5: Month and Year selection
  const [selectedMonth, setSelectedMonth] = useState<number | 'all'>('all');
  const [selectedYear, setSelectedYear] = useState<number | 'all'>('all');
  const [typeFilter, setTypeFilter] = useState<TransactionType | 'all'>('all');

  // Modal State for Editing / Deleting a specific transaction
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);

  // Press & Hold / Reorder Account Position State
  const [isReorderModalOpen, setIsReorderModalOpen] = useState(false);
  const [focusedReorderAccountId, setFocusedReorderAccountId] = useState<string | null>(null);
  const [pressingAccountId, setPressingAccountId] = useState<string | null>(null);
  const [isSavingOrder, setIsSavingOrder] = useState(false);
  const longPressTimerRef = useRef<number | null>(null);
  const pointerStartRef = useRef<{ x: number; y: number } | null>(null);
  const longPressTriggeredRef = useRef(false);

  const clearLongPressTimer = () => {
    if (longPressTimerRef.current !== null) {
      window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    pointerStartRef.current = null;
    setPressingAccountId(null);
  };

  useEffect(() => {
    return () => {
      if (longPressTimerRef.current !== null) {
        window.clearTimeout(longPressTimerRef.current);
      }
    };
  }, []);

  const handleMoveAccountToPosition = async (accountId: string, targetIndex: number) => {
    if (!onReorderAccounts || accounts.length < 2) return;
    const currentIndex = accounts.findIndex((a) => a.id === accountId);
    if (currentIndex === -1 || targetIndex < 0 || targetIndex >= accounts.length || currentIndex === targetIndex) {
      return;
    }
    const next = [...accounts];
    const [moved] = next.splice(currentIndex, 1);
    next.splice(targetIndex, 0, moved);
    setIsSavingOrder(true);
    try {
      await onReorderAccounts(next);
    } finally {
      setIsSavingOrder(false);
    }
  };

  const handleOpenReorderModal = (accountId?: string) => {
    if (accounts.length < 2) return;
    setFocusedReorderAccountId(accountId || accounts[0]?.id || null);
    setIsReorderModalOpen(true);
  };

  // Available Years extracted from stored transactions + current year
  const availableYears = useMemo(() => {
    const yearsSet = new Set<number>();
    yearsSet.add(new Date().getFullYear());
    yearsSet.add(2026);
    transactions.forEach((tx) => {
      const y = parseInt(tx.date.slice(0, 4), 10);
      if (!isNaN(y)) yearsSet.add(y);
    });
    return Array.from(yearsSet).sort((a, b) => b - a);
  }, [transactions]);

  // Date filter criteria
  const dateFilter: DateFilterOptions = useMemo(() => {
    return {
      month: selectedMonth !== 'all' ? selectedMonth : undefined,
      year: selectedYear !== 'all' ? selectedYear : undefined,
    };
  }, [selectedMonth, selectedYear]);

  // Requirement 4: Filter and sort transactions strictly newest first
  const filteredTransactions = useMemo(() => {
    const list = CalculationService.filterTransactions(transactions, {
      accountId: selectedAccountId,
      dateFilter,
      typeFilter,
    });
    return CalculationService.sortTransactionsNewestFirst(list);
  }, [transactions, selectedAccountId, dateFilter, typeFilter]);

  // Requirement 3 & 7: Account-Specific and Filter-Specific Income and Expense Calculations
  const totalIncome = useMemo(() => {
    return CalculationService.calculateIncome(transactions, {
      accountId: selectedAccountId,
      dateFilter,
      displayCurrency: prefCurrency,
      ratesRecord: rates,
    });
  }, [transactions, selectedAccountId, dateFilter, prefCurrency, rates]);

  const totalExpense = useMemo(() => {
    return CalculationService.calculateExpense(transactions, {
      accountId: selectedAccountId,
      dateFilter,
      displayCurrency: prefCurrency,
      ratesRecord: rates,
    });
  }, [transactions, selectedAccountId, dateFilter, prefCurrency, rates]);

  // Current balance of selected account or consolidated net balance
  const activeAccountObj = useMemo(() => {
    if (selectedAccountId === 'all') return null;
    return accounts.find((a) => a.id === selectedAccountId) || null;
  }, [accounts, selectedAccountId]);

  const displayedBalance = useMemo(() => {
    if (selectedAccountId === 'all') {
      return CalculationService.calculateConsolidatedBalance(accounts, transactions, prefCurrency, rates);
    }
    if (activeAccountObj) {
      return CalculationService.calculateAccountBalance(activeAccountObj, transactions, rates);
    }
    return 0;
  }, [selectedAccountId, activeAccountObj, accounts, transactions, prefCurrency, rates]);

  const clearFilters = () => {
    setSelectedMonth('all');
    setSelectedYear('all');
    setTypeFilter('all');
  };

  const hasActiveDateFilters = selectedMonth !== 'all' || selectedYear !== 'all' || typeFilter !== 'all';

  return (
    <div className="w-full max-w-5xl mx-auto px-4 py-4 pb-28 md:pb-12 space-y-5">
      {/* 1. Accounts Section Header & All Accounts Toggle */}
      <div className="flex items-center justify-between gap-2 pt-1 flex-wrap">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-extrabold text-[#0B1528] dark:text-white tracking-tight">
            Your Accounts ({accounts.length})
          </h2>
          {accounts.length > 0 && (
            <button
              type="button"
              onClick={() => setSelectedAccountId(selectedAccountId === 'all' ? accounts[0]?.id || 'all' : 'all')}
              className={`text-[11px] font-bold px-2.5 py-1 rounded-lg border transition cursor-pointer ${
                selectedAccountId === 'all'
                  ? 'bg-[#0B1528] text-white border-[#0B1528] dark:bg-blue-600 dark:border-blue-500'
                  : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50'
              }`}
            >
              {selectedAccountId === 'all' ? '✓ All Accounts (Consolidated)' : 'View All Accounts'}
            </button>
          )}
        </div>
        <div className="flex items-center gap-3">
          {accounts.length > 1 && onReorderAccounts && (
            <button
              type="button"
              onClick={() => handleOpenReorderModal()}
              className="text-[11px] font-bold px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:border-blue-400 hover:text-blue-600 dark:hover:text-blue-400 inline-flex items-center gap-1 transition cursor-pointer"
              title="Change account order (#1 is default)"
            >
              <ArrowUpDown className="w-3 h-3" />
              <span>Reorder</span>
            </button>
          )}
          <button
            type="button"
            onClick={onOpenCreateAccount}
            className="text-xs font-bold text-slate-800 dark:text-slate-200 hover:text-blue-600 dark:hover:text-blue-400 transition cursor-pointer"
          >
            + New Account
          </button>
        </div>
      </div>

      {/* 2. Horizontally Scrollable Account Carousel (Requirement 6: Click to filter!) */}
      {accounts.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-6 text-center shadow-xs">
          <h3 className="text-base font-extrabold text-[#0B1528] dark:text-white">
            No accounts created yet
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xs mx-auto mt-1 mb-5 leading-relaxed">
            Create your own Bank, Cash, Personal, or Business accounts. Only accounts you create appear here.
          </p>
          <button
            onClick={onOpenCreateAccount}
            className="w-full sm:w-auto py-2.5 px-6 rounded-xl bg-[#0B1528] hover:bg-[#111e38] text-white font-bold text-xs inline-flex items-center justify-center gap-1.5 shadow-md active:scale-[0.99] transition cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Create First Account</span>
          </button>
        </div>
      ) : (
        <div className="relative">
          <div className="flex items-stretch gap-3 overflow-x-auto pb-3 pt-1 scrollbar-none snap-x -mx-4 px-4 sm:mx-0 sm:px-0">
            {/* "All Accounts" Card option in carousel */}
            <div
              onClick={() => setSelectedAccountId('all')}
              className={`shrink-0 w-60 sm:w-64 snap-start p-4 rounded-2xl border transition-all cursor-pointer relative overflow-hidden select-none ${
                selectedAccountId === 'all'
                  ? 'ring-3 ring-blue-500 shadow-lg scale-[1.01]'
                  : 'opacity-85 hover:opacity-100 hover:shadow-sm'
              }`}
              style={{
                backgroundColor: '#0B1528',
                borderColor: selectedAccountId === 'all' ? '#3B82F6' : 'rgba(255, 255, 255, 0.15)',
                color: '#FFFFFF',
              }}
            >
              <div className="flex items-center justify-between mb-3 relative z-10">
                <span className="text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full bg-white/20 text-white backdrop-blur-xs">
                  Consolidated
                </span>
                <div className="w-8 h-8 rounded-xl bg-white/20 backdrop-blur-xs flex items-center justify-center text-white">
                  <Layers className="w-4 h-4 text-white" />
                </div>
              </div>

              <div className="text-xs sm:text-sm font-extrabold text-white tracking-wide uppercase truncate relative z-10">
                All Accounts
              </div>

              <div className="text-lg sm:text-xl font-extrabold font-mono-numbers text-white mt-1 relative z-10">
                {formatCurrency(
                  CalculationService.calculateConsolidatedBalance(accounts, transactions, prefCurrency, rates),
                  prefCurrency
                )}
              </div>

              <div className="flex items-center justify-between text-[10px] text-white/70 pt-3 mt-2 border-t border-white/15 relative z-10 font-medium">
                <span>{accounts.length} Accounts Active</span>
                <span className="font-bold text-amber-300">
                  {selectedAccountId === 'all' ? '● Active View' : 'Select'}
                </span>
              </div>
            </div>

            {/* Individual Account Cards (Press & hold to reorder position) */}
            {accounts.map((acc, idx) => {
              const isSelected = selectedAccountId === acc.id;
              const isPressing = pressingAccountId === acc.id;
              const currentAccBalance = CalculationService.calculateAccountBalance(acc, transactions, rates);
              const convertedVal = convertCurrency(currentAccBalance, acc.currency, prefCurrency, rates);
              const isDifferent = acc.currency !== prefCurrency;
              const cardColor = acc.color || '#2563EB';
              const positionNumber = idx + 1;

              return (
                <div
                  key={acc.id}
                  onPointerDown={(e) => {
                    if (accounts.length < 2 || !onReorderAccounts) return;
                    if (e.pointerType === 'mouse' && e.button !== 0) return;
                    clearLongPressTimer();
                    longPressTriggeredRef.current = false;
                    pointerStartRef.current = { x: e.clientX, y: e.clientY };
                    setPressingAccountId(acc.id);
                    longPressTimerRef.current = window.setTimeout(() => {
                      longPressTriggeredRef.current = true;
                      setPressingAccountId(null);
                      if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
                        navigator.vibrate(35);
                      }
                      handleOpenReorderModal(acc.id);
                    }, 450);
                  }}
                  onPointerMove={(e) => {
                    if (!pointerStartRef.current) return;
                    const dist = Math.hypot(
                      e.clientX - pointerStartRef.current.x,
                      e.clientY - pointerStartRef.current.y
                    );
                    if (dist > 10) {
                      clearLongPressTimer();
                    }
                  }}
                  onPointerUp={clearLongPressTimer}
                  onPointerLeave={clearLongPressTimer}
                  onPointerCancel={clearLongPressTimer}
                  onContextMenu={(e) => {
                    if (accounts.length > 1) {
                      e.preventDefault();
                    }
                  }}
                  onClick={() => {
                    if (longPressTriggeredRef.current) {
                      longPressTriggeredRef.current = false;
                      return;
                    }
                    setSelectedAccountId(acc.id);
                  }}
                  className={`shrink-0 w-64 sm:w-72 snap-start p-4 rounded-2xl border transition-all cursor-pointer relative overflow-hidden select-none touch-pan-x ${
                    isPressing
                      ? 'scale-[0.97] ring-3 ring-amber-300 shadow-2xl'
                      : isSelected
                      ? 'ring-3 ring-white dark:ring-blue-400 shadow-xl scale-[1.01]'
                      : 'opacity-85 hover:opacity-100 hover:shadow-sm'
                  }`}
                  style={{
                    backgroundColor: cardColor,
                    borderColor: isSelected ? '#FFFFFF' : 'rgba(255, 255, 255, 0.2)',
                    color: '#FFFFFF',
                    WebkitTouchCallout: 'none',
                  }}
                >
                  {/* Active Selection Badge */}
                  {isSelected && (
                    <div className="absolute top-2 right-2 z-20 bg-white text-slate-900 text-[9px] font-extrabold px-1.5 py-0.5 rounded-full shadow-xs flex items-center gap-0.5">
                      <CheckCircle2 className="w-2.5 h-2.5 text-blue-600" /> Active
                    </div>
                  )}

                  {/* Top Row: Position, Type and Icon */}
                  <div className="flex items-center justify-between mb-3 relative z-10 pr-12">
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full backdrop-blur-xs inline-flex items-center gap-1 ${
                          positionNumber === 1
                            ? 'bg-amber-400/95 text-slate-950 shadow-2xs'
                            : 'bg-black/25 text-white'
                        }`}
                      >
                        {positionNumber === 1 && <Star className="w-2.5 h-2.5 fill-slate-950" />}
                        #{positionNumber}
                        {positionNumber === 1 ? ' Default' : ''}
                      </span>
                      <span className="text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full bg-white/20 text-white backdrop-blur-xs">
                        {acc.type}
                      </span>
                    </div>

                    <div className="w-8 h-8 rounded-xl bg-white/20 backdrop-blur-xs flex items-center justify-center text-white shrink-0">
                      <DynamicIcon name={acc.icon || 'Landmark'} className="w-4 h-4 text-white" />
                    </div>
                  </div>

                  {/* Account Name */}
                  <div className="text-xs sm:text-sm font-extrabold text-white tracking-wide uppercase truncate relative z-10 pr-12">
                    {acc.name}
                  </div>

                  {/* Balance Display */}
                  <div className="text-lg sm:text-xl font-extrabold font-mono-numbers text-white mt-1 relative z-10">
                    {formatCurrency(currentAccBalance, acc.currency)}
                  </div>

                  {/* Converted Balance if different currency */}
                  {isDifferent && (
                    <div className="text-[11px] text-white/80 font-mono-numbers mt-0.5 truncate relative z-10">
                      ≈ {formatCurrency(convertedVal, prefCurrency)}
                    </div>
                  )}

                  {/* Bottom details */}
                  <div className="flex items-center justify-between text-[10px] text-white/75 pt-3 mt-2 border-t border-white/15 relative z-10 font-medium">
                    <span>{acc.currency} Account</span>
                    <span className="font-bold underline">
                      {isSelected ? 'Filtering Transactions' : 'Click to Filter'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
          {accounts.length > 1 && onReorderAccounts && (
            <p className="text-[11px] text-slate-400 dark:text-slate-500 px-1 mt-0.5">
              Tip: Press & hold any account card to change its place (#1 is selected by default for new entries).
            </p>
          )}
        </div>
      )}

      {/* 3. Account-Specific Active Filter Banner & Income / Expense Cards */}
      <div className="space-y-3">
        <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300 px-1">
          <span>
            {selectedAccountId === 'all' ? (
              'Showing: Consolidated All Accounts'
            ) : (
              <span>
                Showing Account: <strong className="text-blue-600 dark:text-blue-400">{activeAccountObj?.name}</strong>{' '}
                ({formatCurrency(displayedBalance, activeAccountObj?.currency || prefCurrency)})
              </span>
            )}
          </span>
          <span className="text-[11px] text-slate-400 font-mono">{filteredTransactions.length} entries</span>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {/* Income Card */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-4 shadow-xs">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">Income</span>
              <div className="w-7 h-7 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                <ArrowDownLeft className="w-4 h-4" />
              </div>
            </div>
            <div className="text-xl sm:text-2xl font-extrabold font-mono-numbers text-emerald-500 dark:text-emerald-400">
              +{formatCurrency(totalIncome, prefCurrency)}
            </div>
            <span className="text-[10px] text-slate-400 block mt-1">
              {filteredTransactions.filter((t) => t.type === 'income').length} credit transactions
            </span>
          </div>

          {/* Expense Card */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-4 shadow-xs">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-bold text-rose-600 dark:text-rose-400">Expense</span>
              <div className="w-7 h-7 rounded-lg bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 flex items-center justify-center">
                <ArrowUpRight className="w-4 h-4" />
              </div>
            </div>
            <div className="text-xl sm:text-2xl font-extrabold font-mono-numbers text-rose-500 dark:text-rose-400">
              -{formatCurrency(totalExpense, prefCurrency)}
            </div>
            <span className="text-[10px] text-slate-400 block mt-1">
              {filteredTransactions.filter((t) => t.type === 'expense').length} debit transactions
            </span>
          </div>
        </div>
      </div>

      {/* 4. Filter Toolbar: Month, Year, Type Filter, & Clear Action (Requirement 5) */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-4 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <h3 className="text-xs font-extrabold text-[#0B1528] dark:text-white uppercase tracking-wider">
              Filter Statements
            </h3>
          </div>

          {hasActiveDateFilters && (
            <button
              onClick={clearFilters}
              className="text-[11px] font-bold text-rose-600 dark:text-rose-400 hover:underline flex items-center gap-1 cursor-pointer"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Clear Filters</span>
            </button>
          )}
        </div>

        {/* Month & Year Selectors */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {/* Month Selector */}
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Month</label>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value === 'all' ? 'all' : parseInt(e.target.value, 10))}
              className="w-full px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold text-slate-800 dark:text-white cursor-pointer"
            >
              <option value="all">All Months</option>
              {MONTH_NAMES.map((name, idx) => (
                <option key={name} value={idx + 1}>
                  {name}
                </option>
              ))}
            </select>
          </div>

          {/* Year Selector */}
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Year</label>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value === 'all' ? 'all' : parseInt(e.target.value, 10))}
              className="w-full px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold text-slate-800 dark:text-white cursor-pointer"
            >
              <option value="all">All Years</option>
              {availableYears.map((yr) => (
                <option key={yr} value={yr}>
                  {yr}
                </option>
              ))}
            </select>
          </div>

          {/* Type Selector */}
          <div className="col-span-2 sm:col-span-1">
            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Type</label>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as any)}
              className="w-full px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold text-slate-800 dark:text-white cursor-pointer"
            >
              <option value="all">All Types</option>
              <option value="income">Income Only</option>
              <option value="expense">Expense Only</option>
              <option value="transfer">Transfers Only</option>
            </select>
          </div>
        </div>
      </div>

      {/* 5. Statement List / Empty State with Edit & Delete Options (Requirement 4 & 8) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-xs font-extrabold text-[#0B1528] dark:text-white uppercase tracking-wider">
            Transaction History ({filteredTransactions.length})
          </h3>
          <span className="text-[11px] text-slate-400">Sorted Newest First</span>
        </div>

        {filteredTransactions.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-8 text-center shadow-xs space-y-4">
            <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
              No statements found for this filter
            </p>
            <button
              onClick={onOpenAddModal}
              className="w-full sm:w-auto py-2.5 px-6 rounded-xl bg-[#0B1528] hover:bg-[#111e38] text-white font-bold text-xs inline-flex items-center justify-center gap-1.5 shadow-md active:scale-[0.99] transition cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Add Entry</span>
            </button>
          </div>
        ) : (
          <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl divide-y divide-slate-100 dark:divide-slate-800 shadow-xs overflow-hidden">
            {filteredTransactions.map((tx) => {
              const converted = convertCurrency(
                tx.amount,
                tx.currency,
                prefCurrency,
                rates,
                tx.exchangeRateAtTransaction
              );
              const isDifferent = tx.currency !== prefCurrency;
              const isIncome = tx.type === 'income';
              const isTransfer = tx.type === 'transfer';
              const sourceAccount = accounts.find((a) => a.id === tx.accountId);
              const destAccount = tx.toAccountId ? accounts.find((a) => a.id === tx.toAccountId) : null;

              return (
                <div
                  key={tx.id}
                  className="p-3.5 flex items-center justify-between hover:bg-slate-50/80 dark:hover:bg-slate-800/60 transition group"
                >
                  {/* Left Side: Icon & Details */}
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                        isIncome
                          ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600'
                          : isTransfer
                          ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-600'
                          : 'bg-rose-50 dark:bg-rose-950/40 text-rose-600'
                      }`}
                    >
                      {isIncome ? (
                        <ArrowDownLeft className="w-4 h-4" />
                      ) : isTransfer ? (
                        <ArrowRightLeft className="w-4 h-4" />
                      ) : (
                        <ArrowUpRight className="w-4 h-4" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-bold text-slate-900 dark:text-white truncate flex items-center gap-1.5">
                        <span className="truncate">{tx.description || tx.category}</span>
                        {isTransfer && destAccount && (
                          <span className="text-[10px] text-blue-600 dark:text-blue-400 font-normal">
                            → {destAccount.name}
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 truncate flex items-center gap-1.5">
                        <span className="font-medium">{tx.date}</span>
                        {tx.time && <span>• {tx.time}</span>}
                        <span>• {sourceAccount?.name || 'Account'}</span>
                        <span>• {tx.paymentMode}</span>
                      </div>
                    </div>
                  </div>

                  {/* Right Side: Amount & Action Buttons (Requirement 8) */}
                  <div className="flex items-center gap-2 shrink-0 pl-3">
                    <div className="text-right">
                      <div
                        className={`text-xs sm:text-sm font-extrabold font-mono-numbers ${
                          isIncome
                            ? 'text-emerald-500'
                            : isTransfer
                            ? 'text-blue-600 dark:text-blue-400'
                            : 'text-rose-500'
                        }`}
                      >
                        {isIncome ? '+' : isTransfer ? '' : '-'}
                        {formatCurrency(converted, prefCurrency)}
                      </div>
                      {isDifferent && (
                        <div className="text-[10px] text-slate-400 font-mono-numbers">
                          Orig: {formatCurrency(tx.amount, tx.currency)}
                        </div>
                      )}
                    </div>

                    {/* Edit & Delete Action Buttons */}
                    <div className="flex items-center gap-1 ml-1 opacity-90 group-hover:opacity-100">
                      <button
                        onClick={() => setEditingTransaction(tx)}
                        className="w-7 h-7 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 hover:border-blue-300 flex items-center justify-center transition cursor-pointer"
                        title="Edit Transaction"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => {
                          setEditingTransaction(tx);
                        }}
                        className="w-7 h-7 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-500 hover:text-rose-600 hover:border-rose-300 flex items-center justify-center transition cursor-pointer"
                        title="Delete Transaction"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Edit Transaction Modal */}
      <EditTransactionModal
        isOpen={Boolean(editingTransaction)}
        onClose={() => setEditingTransaction(null)}
        transaction={editingTransaction}
        profile={profile}
        accounts={accounts}
        categories={categories}
        onSaveTransaction={onUpdateTransaction}
        onDeleteTransaction={onDeleteTransaction}
      />

      {/* Change Account Position / Reorder Modal */}
      {isReorderModalOpen && accounts.length > 1 && (() => {
        const focusedIdx = accounts.findIndex((a) => a.id === focusedReorderAccountId);
        const focusedAccount = focusedIdx >= 0 ? accounts[focusedIdx] : accounts[0];
        const effectiveIdx = focusedIdx >= 0 ? focusedIdx : 0;

        return (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-2xs animate-in fade-in"
            onClick={() => setIsReorderModalOpen(false)}
          >
            <div
              className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-md p-5 shadow-2xl border border-slate-100 dark:border-slate-800 max-h-[88vh] overflow-y-auto space-y-4 text-slate-900 dark:text-white"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                    <ArrowUpDown className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-extrabold text-[#0B1528] dark:text-white">
                      Change Account Position
                    </h3>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Position #1 is used as default when adding entries
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsReorderModalOpen(false)}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Direct Place Selector (1 No, 2 No, 3 No...) for Focused Account */}
              {focusedAccount && (
                <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200/80 dark:border-slate-700 space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div
                        className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 text-white shadow-2xs"
                        style={{ backgroundColor: focusedAccount.color || '#2563EB' }}
                      >
                        <DynamicIcon name={focusedAccount.icon || 'Landmark'} className="w-4 h-4 text-white" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-extrabold text-slate-900 dark:text-white truncate uppercase">
                          {focusedAccount.name}
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400">
                          Current Place: <strong className="text-blue-600 dark:text-blue-400">#{effectiveIdx + 1}</strong>
                          {effectiveIdx === 0 ? ' (Default)' : ''}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div>
                    <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                      Tap a position number to place this account there:
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {accounts.map((slotAcc, slotIdx) => {
                        const isCurrentSlot = slotIdx === effectiveIdx;
                        return (
                          <button
                            key={slotAcc.id}
                            type="button"
                            disabled={isSavingOrder || isCurrentSlot}
                            onClick={() => handleMoveAccountToPosition(focusedAccount.id, slotIdx)}
                            className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition cursor-pointer flex items-center gap-1 ${
                              isCurrentSlot
                                ? 'bg-[#0B1528] dark:bg-blue-600 text-white shadow-xs cursor-default'
                                : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-blue-500 hover:text-blue-600 dark:hover:text-blue-400'
                            }`}
                          >
                            {slotIdx === 0 && <Star className={`w-3 h-3 ${isCurrentSlot ? 'fill-amber-300 text-amber-300' : 'text-amber-500'}`} />}
                            <span>#{slotIdx + 1}{slotIdx === 0 ? ' Default' : ''}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* Full Ordered List with Up / Down / Make #1 Controls */}
              <div className="space-y-2">
                <div className="flex items-center justify-between px-1">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    All Accounts Order
                  </span>
                  {isSavingOrder && (
                    <span className="text-[11px] font-bold text-blue-600 dark:text-blue-400">Saving...</span>
                  )}
                </div>

                <div className="space-y-2">
                  {accounts.map((acc, index) => {
                    const isFocused = focusedAccount?.id === acc.id;
                    const bal = CalculationService.calculateAccountBalance(acc, transactions, rates);
                    return (
                      <div
                        key={acc.id}
                        onClick={() => setFocusedReorderAccountId(acc.id)}
                        className={`p-2.5 rounded-2xl border flex items-center justify-between gap-2 transition cursor-pointer ${
                          isFocused
                            ? 'border-blue-500 bg-blue-50/60 dark:bg-blue-950/30'
                            : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-700'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                          <span
                            className={`w-7 h-7 rounded-xl text-xs font-extrabold flex items-center justify-center shrink-0 ${
                              index === 0
                                ? 'bg-amber-400 text-slate-950'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                            }`}
                          >
                            {index + 1}
                          </span>
                          <div
                            className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 text-white"
                            style={{ backgroundColor: acc.color || '#2563EB' }}
                          >
                            <DynamicIcon name={acc.icon || 'Landmark'} className="w-4 h-4 text-white" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs font-extrabold text-slate-900 dark:text-white truncate uppercase">
                                {acc.name}
                              </span>
                              {index === 0 && (
                                <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/50 text-amber-800 dark:text-amber-300 shrink-0">
                                  Default
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] font-mono-numbers text-slate-500 dark:text-slate-400">
                              {formatCurrency(bal, acc.currency)}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                          {index > 0 && (
                            <button
                              type="button"
                              disabled={isSavingOrder}
                              onClick={() => handleMoveAccountToPosition(acc.id, 0)}
                              className="px-2 py-1 rounded-lg bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 text-[10px] font-extrabold hover:bg-amber-100 transition cursor-pointer"
                              title="Set as #1 Default"
                            >
                              Make #1
                            </button>
                          )}
                          <button
                            type="button"
                            disabled={index === 0 || isSavingOrder}
                            onClick={() => handleMoveAccountToPosition(acc.id, index - 1)}
                            className="w-7 h-7 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-blue-600 disabled:opacity-30 flex items-center justify-center transition cursor-pointer"
                            title="Move Up"
                          >
                            <ArrowUp className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            disabled={index === accounts.length - 1 || isSavingOrder}
                            onClick={() => handleMoveAccountToPosition(acc.id, index + 1)}
                            className="w-7 h-7 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-blue-600 disabled:opacity-30 flex items-center justify-center transition cursor-pointer"
                            title="Move Down"
                          >
                            <ArrowDown className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="flex justify-end pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsReorderModalOpen(false)}
                  className="px-5 py-2 rounded-xl bg-[#0B1528] dark:bg-blue-600 text-white font-bold text-xs shadow-sm hover:bg-[#111e38] transition cursor-pointer"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};
