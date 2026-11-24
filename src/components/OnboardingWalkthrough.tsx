/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ArrowLeft, ArrowRight, Cloud, Sparkles, Wallet } from 'lucide-react';
import realLedgerImg from '../assets/images/onboarding_real_ledger_1795551295616.jpg';
import realAiInsightsImg from '../assets/images/onboarding_real_ai_insights_1795551295898.jpg';
import realWealthFreeImg from '../assets/images/onboarding_real_wealth_free_1795551298268.jpg';

const ONBOARDING_STORAGE_KEY = 'ai_money_manager_onboarding_completed_v1';

export function hasCompletedOnboarding(): boolean {
  try {
    return localStorage.getItem(ONBOARDING_STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

export function markOnboardingCompleted(): void {
  try {
    localStorage.setItem(ONBOARDING_STORAGE_KEY, 'true');
  } catch {
    // Ignore storage errors in restricted webviews
  }
}

export function resetOnboardingCompleted(): void {
  try {
    localStorage.removeItem(ONBOARDING_STORAGE_KEY);
  } catch {
    // Ignore storage errors
  }
}

interface OnboardingSlide {
  id: number;
  step: string;
  image: string;
  imageAlt: string;
  fallbackIcon: 'wallet' | 'ai' | 'cloud';
  kicker: string;
  title: string;
  description: string;
}

const SLIDES: OnboardingSlide[] = [
  {
    id: 0,
    step: '01',
    image: realLedgerImg,
    imageAlt: 'Young professional checking his finances effortlessly on a smartphone in a modern workspace',
    fallbackIcon: 'wallet',
    kicker: 'Unified Ledger',
    title: 'Every account in one clear view.',
    description: 'Track Bank, UPI, and Cash balances in real time without clutter.',
  },
  {
    id: 1,
    step: '02',
    image: realAiInsightsImg,
    imageAlt: 'Professional woman reviewing AI-powered spending insights on her smartphone at a minimalist desk',
    fallbackIcon: 'ai',
    kicker: 'AI Assistant',
    title: 'Smarter money decisions daily.',
    description: 'Ask your AI finance guide for instant cash flow analysis and monthly budgets.',
  },
  {
    id: 2,
    step: '03',
    image: realWealthFreeImg,
    imageAlt: 'Entrepreneur relaxing by a city skyline window checking synced financial accounts on his phone',
    fallbackIcon: 'cloud',
    kicker: 'Private & Free',
    title: 'Synced everywhere. 100% free.',
    description: 'Protected with Google Cloud backup, PIN lock, and zero subscription fees.',
  },
];

interface OnboardingWalkthroughProps {
  onComplete: () => void;
}

export const OnboardingWalkthrough: React.FC<OnboardingWalkthroughProps> = ({ onComplete }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [failedImages, setFailedImages] = useState<Record<number, boolean>>({});
  const touchStartXRef = useRef<number | null>(null);

  const slide = SLIDES[currentIndex];
  const isFirst = currentIndex === 0;
  const isLast = currentIndex === SLIDES.length - 1;

  const handleFinish = useCallback(() => {
    markOnboardingCompleted();
    onComplete();
  }, [onComplete]);

  const handleNext = useCallback(() => {
    if (isLast) {
      handleFinish();
    } else {
      setCurrentIndex((prev) => Math.min(prev + 1, SLIDES.length - 1));
    }
  }, [isLast, handleFinish]);

  const handlePrev = useCallback(() => {
    setCurrentIndex((prev) => Math.max(prev - 1, 0));
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') handleNext();
      else if (e.key === 'ArrowLeft') handlePrev();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleNext, handlePrev]);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartXRef.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartXRef.current === null) return;
    const deltaX = e.changedTouches[0].clientX - touchStartXRef.current;
    touchStartXRef.current = null;
    if (Math.abs(deltaX) < 48) return;
    if (deltaX < 0) handleNext();
    else if (deltaX > 0 && !isFirst) handlePrev();
  };

  const renderFallback = (icon: OnboardingSlide['fallbackIcon']) => {
    const Icon = icon === 'wallet' ? Wallet : icon === 'ai' ? Sparkles : Cloud;
    return (
      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-slate-900 to-[#070D19]">
        <div className="w-20 h-20 rounded-3xl bg-white/5 border border-white/10 flex items-center justify-center text-emerald-400">
          <Icon className="w-9 h-9" />
        </div>
      </div>
    );
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-[#070D19] text-white overflow-hidden select-none"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Responsive Editorial Layout: Full-bleed immersive portrait on mobile, 50/50 studio split on desktop */}
      <div className="relative w-full h-full grid grid-cols-1 lg:grid-cols-2">
        {/* PHOTOGRAPH CANVAS */}
        <div className="absolute inset-0 lg:relative lg:inset-auto w-full h-full overflow-hidden bg-slate-950">
          {!failedImages[slide.id] ? (
            <img
              key={slide.id}
              src={slide.image}
              alt={slide.imageAlt}
              referrerPolicy="no-referrer"
              onError={() => setFailedImages((prev) => ({ ...prev, [slide.id]: true }))}
              className="w-full h-full object-cover object-top animate-slide-reveal"
            />
          ) : (
            renderFallback(slide.fallbackIcon)
          )}

          {/* Measured Top & Bottom Scrims on Mobile for crisp WCAG AA legibility */}
          <div
            className="absolute inset-0 bg-gradient-to-b from-[#070D19]/75 via-transparent via-30% to-transparent lg:hidden pointer-events-none"
            aria-hidden="true"
          />
          <div
            className="absolute inset-0 bg-gradient-to-t from-[#070D19] via-[#070D19]/88 via-36% to-transparent lg:bg-gradient-to-t lg:from-[#070D19]/70 lg:via-transparent lg:to-transparent pointer-events-none"
            aria-hidden="true"
          />

          {/* Desktop Subtle Brand Mark over Photo */}
          <div className="hidden lg:flex items-center justify-between absolute top-8 left-10 right-10">
            <span className="font-display text-base font-bold tracking-tight text-white drop-shadow-xs">
              AI Money Manager
            </span>
          </div>
        </div>

        {/* EDITORIAL CONTENT & CONTROLS PANEL */}
        <div className="relative z-10 flex flex-col justify-between h-full px-6 sm:px-10 lg:px-16 pt-[calc(1rem+env(safe-area-inset-top,0px))] pb-[calc(1.75rem+env(safe-area-inset-bottom,0px))] lg:py-10 lg:bg-[#070D19]">
          {/* Top Row: Step Counter + Skip */}
          <header className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-xs font-semibold tracking-wide text-slate-200 lg:text-slate-400">
              <span className="lg:hidden font-display font-bold text-white text-sm">AI Money Manager</span>
              <span className="lg:hidden text-white/35" aria-hidden="true">·</span>
              <span className="font-mono-numbers">
                {slide.step} / 0{SLIDES.length}
              </span>
            </div>

            <button
              type="button"
              onClick={handleFinish}
              className="min-h-[44px] px-3 -mr-2 text-sm font-semibold text-white/85 lg:text-slate-400 hover:text-white transition-colors whitespace-nowrap cursor-pointer"
            >
              Skip
            </button>
          </header>

          {/* Bottom-Anchored Content on Mobile / Vertically Centered on Desktop */}
          <div className="mt-auto lg:my-auto max-w-md w-full lg:mx-auto space-y-7">
            <div key={slide.id} className="space-y-3 animate-slide-reveal">
              <p className="text-xs font-semibold tracking-wide text-emerald-400">
                {slide.kicker}
              </p>

              <h1 className="font-display text-[32px] sm:text-4xl lg:text-[42px] font-extrabold tracking-tight text-white leading-[1.12] [text-wrap:balance]">
                {slide.title}
              </h1>

              <p className="text-[15px] sm:text-base text-slate-300 leading-relaxed max-w-sm">
                {slide.description}
              </p>
            </div>

            {/* Step Progress Bars */}
            <div className="flex items-center gap-2" role="tablist" aria-label="Onboarding steps">
              {SLIDES.map((s, idx) => {
                const active = idx === currentIndex;
                return (
                  <button
                    key={s.id}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    aria-label={`Slide ${idx + 1}: ${s.title}`}
                    onClick={() => setCurrentIndex(idx)}
                    className="py-2 flex items-center cursor-pointer focus-visible:outline-2 focus-visible:outline-emerald-400 rounded"
                  >
                    <span
                      className={`block h-[3px] rounded-full transition-all duration-300 ${
                        active
                          ? 'w-10 bg-emerald-400'
                          : 'w-4 bg-white/25 hover:bg-white/45'
                      }`}
                    />
                  </button>
                );
              })}
            </div>

            {/* Navigation Actions */}
            <div className="flex items-center gap-3 pt-1">
              {!isFirst && (
                <button
                  type="button"
                  onClick={handlePrev}
                  aria-label="Previous slide"
                  className="min-h-[52px] min-w-[52px] px-4 rounded-2xl border border-white/15 bg-white/5 text-white hover:bg-white/10 active:scale-[0.98] transition flex items-center justify-center shrink-0 cursor-pointer"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
              )}

              <button
                type="button"
                onClick={handleNext}
                className="flex-1 min-h-[52px] px-6 rounded-2xl bg-white text-[#070D19] hover:bg-emerald-50 active:scale-[0.98] transition font-display font-bold text-[15px] shadow-lg shadow-black/25 flex items-center justify-center gap-2 whitespace-nowrap cursor-pointer"
              >
                <span>{isLast ? 'Get Started' : 'Next'}</span>
                <ArrowRight className="w-4 h-4 shrink-0" />
              </button>
            </div>
          </div>

          {/* Quiet desktop bottom spacer for vertical alignment */}
          <div className="hidden lg:block h-6" aria-hidden="true" />
        </div>
      </div>
    </div>
  );
};
