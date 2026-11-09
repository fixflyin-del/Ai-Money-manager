/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { Account, CurrencyCode, Transaction, UserProfile } from '../types/finance';
import { AndroidBridge } from './androidBridge';
import { convertCurrency, formatCurrency, getCachedRates } from './currencyService';

export class ExportService {
  /**
   * Export PDF Statement using jsPDF & autoTable
   */
  static generatePdfStatement(
    transactions: Transaction[],
    accounts: Account[],
    profile: UserProfile,
    dateRangeLabel: string = 'Current Financial Period'
  ): void {
    const doc = new jsPDF();
    const rates = getCachedRates().rates;
    const prefCurrency = profile.preferredCurrency;

    // FixFly Emerald & Dark Theme styling
    doc.setFillColor(15, 23, 42); // #0F172A
    doc.rect(0, 0, 210, 38, 'F');

    // Header Title
    doc.setFontSize(20);
    doc.setTextColor(16, 185, 129); // #10B981 Emerald
    doc.text('AI MONEY MANAGER', 14, 18);

    doc.setFontSize(10);
    doc.setTextColor(203, 213, 225); // Slate 300
    doc.text('FixFly Financial Technologies — aimoney.fixfly.in', 14, 26);
    doc.text(`Generated: ${new Date().toLocaleDateString()} | User: ${profile.name}`, 14, 32);

    // Metadata Card
    doc.setFontSize(10);
    doc.setTextColor(71, 85, 105);
    doc.text(`Statement Period: ${dateRangeLabel}`, 14, 46);
    doc.text(`Display Currency: ${prefCurrency} (Converted values use live FixFly exchange rates)`, 14, 52);

    // Calculate Summary Totals in Display Currency
    let totalIncome = 0;
    let totalExpense = 0;

    transactions.forEach((tx) => {
      const converted = convertCurrency(tx.amount, tx.currency, prefCurrency, rates, tx.exchangeRateAtTransaction);
      if (tx.type === 'income') totalIncome += converted;
      else if (tx.type === 'expense') totalExpense += converted;
    });

    const netSavings = totalIncome - totalExpense;

    // Summary Box
    doc.setFillColor(241, 245, 249);
    doc.roundedRect(14, 56, 182, 22, 3, 3, 'F');

    doc.setFontSize(9);
    doc.setTextColor(15, 23, 42);
    doc.text(`Total Income: ${formatCurrency(totalIncome, prefCurrency)}`, 20, 68);
    doc.text(`Total Expenses: ${formatCurrency(totalExpense, prefCurrency)}`, 80, 68);
    doc.setTextColor(netSavings >= 0 ? 16 : 220, netSavings >= 0 ? 185 : 38, netSavings >= 0 ? 129 : 38);
    doc.text(`Net Cashflow: ${formatCurrency(netSavings, prefCurrency)}`, 140, 68);

    // Table Data
    const tableBody = transactions.map((tx) => {
      const converted = convertCurrency(tx.amount, tx.currency, prefCurrency, rates, tx.exchangeRateAtTransaction);
      const acc = accounts.find((a) => a.id === tx.accountId)?.name || 'Account';
      
      const originalText = tx.currency !== prefCurrency
        ? `${tx.currency} ${tx.amount.toFixed(2)}`
        : '-';

      return [
        tx.date,
        tx.description || tx.category,
        tx.category,
        acc,
        tx.paymentMode,
        originalText,
        `${tx.type === 'expense' ? '-' : '+'}${formatCurrency(converted, prefCurrency)}`,
      ];
    });

    autoTable(doc, {
      startY: 84,
      head: [['Date', 'Description', 'Category', 'Account', 'Mode', 'Orig. Amount', `Display (${prefCurrency})`]],
      body: tableBody,
      headStyles: {
        fillColor: [15, 23, 42],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
      },
      styles: {
        fontSize: 8,
        cellPadding: 3,
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252],
      },
    });

    // Save or Hand off to Android MediaStore
    const pdfFilename = `FixFly_Statement_${prefCurrency}_${Date.now()}.pdf`;
    if (AndroidBridge.isAndroid()) {
      const base64Data = doc.output('datauristring').split(',')[1];
      AndroidBridge.saveBase64File(pdfFilename, 'application/pdf', base64Data);
    } else {
      doc.save(pdfFilename);
    }
  }

  /**
   * Export Excel spreadsheet (.xlsx) with multi-sheet support
   */
  static exportExcelSheet(
    transactions: Transaction[],
    accounts: Account[],
    profile: UserProfile
  ): void {
    const rates = getCachedRates().rates;
    const prefCurrency = profile.preferredCurrency;

    // Sheet 1: Transactions
    const txData = transactions.map((t) => {
      const converted = convertCurrency(t.amount, t.currency, prefCurrency, rates, t.exchangeRateAtTransaction);
      const acc = accounts.find((a) => a.id === t.accountId)?.name || t.accountId;
      return {
        'Transaction ID': t.id,
        Date: t.date,
        Type: t.type.toUpperCase(),
        Description: t.description,
        Category: t.category,
        'Original Amount': t.amount,
        'Original Currency': t.currency,
        [`Converted Amount (${prefCurrency})`]: Number(converted.toFixed(2)),
        'Display Currency': prefCurrency,
        'Exchange Rate Used': t.exchangeRateAtTransaction || rates[t.currency] || 1,
        Account: acc,
        'Payment Mode': t.paymentMode,
        Tags: (t.tags || []).join(', '),
      };
    });

    // Sheet 2: Accounts
    const accData = accounts.map((a) => {
      const converted = convertCurrency(a.balance, a.currency, prefCurrency, rates);
      return {
        'Account Name': a.name,
        Type: a.type.toUpperCase(),
        'Native Balance': a.balance,
        'Account Currency': a.currency,
        [`Converted Balance (${prefCurrency})`]: Number(converted.toFixed(2)),
      };
    });

    const wb = XLSX.utils.book_new();
    const wsTx = XLSX.utils.json_to_sheet(txData);
    const wsAcc = XLSX.utils.json_to_sheet(accData);

    XLSX.utils.book_append_sheet(wb, wsTx, 'Transactions');
    XLSX.utils.book_append_sheet(wb, wsAcc, 'Accounts');

    const excelFilename = `FixFly_Finance_${prefCurrency}_${Date.now()}.xlsx`;
    if (AndroidBridge.isAndroid()) {
      const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'base64' });
      AndroidBridge.saveBase64File(
        excelFilename,
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        wbout
      );
    } else {
      XLSX.writeFile(wb, excelFilename);
    }
  }
}
