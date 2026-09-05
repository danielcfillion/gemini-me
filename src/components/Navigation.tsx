import React from 'react';
import { NavTab } from '../types/journal';

interface NavigationProps {
  currentTab: NavTab;
  onTabChange: (tab: NavTab) => void;
}

export const Navigation: React.FC<NavigationProps> = ({ currentTab, onTabChange }) => {
  return (
    <header className="w-full max-w-[680px] mx-auto pt-6 pb-4 px-4 sm:px-6 flex items-center justify-between border-b border-[#EBE7DF] dark:border-[#2A2724]">
      {/* Brand mark */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onTabChange('today')}
          className="group text-left cursor-pointer focus:outline-none"
        >
          <span className="font-journal text-xl font-medium tracking-tight text-[#1F1E1D] dark:text-[#EAE6E1] group-hover:opacity-80 transition-opacity">
            Gemini Me
          </span>
        </button>
      </div>

      {/* Nav items: Today, History, Profile (with reserved slot for future Boards) */}
      <nav aria-label="Main navigation" className="flex items-center gap-1 sm:gap-2">
        <button
          id="nav-tab-today"
          type="button"
          onClick={() => onTabChange('today')}
          className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors cursor-pointer ${
            currentTab === 'today'
              ? 'text-[#1F1E1D] dark:text-[#FAF8F5] bg-[#EFECE6] dark:bg-[#282522]'
              : 'text-[#74706B] dark:text-[#A09B94] hover:text-[#1F1E1D] dark:hover:text-[#FAF8F5]'
          }`}
        >
          Today
        </button>
        <button
          id="nav-tab-history"
          type="button"
          onClick={() => onTabChange('history')}
          className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors cursor-pointer ${
            currentTab === 'history'
              ? 'text-[#1F1E1D] dark:text-[#FAF8F5] bg-[#EFECE6] dark:bg-[#282522]'
              : 'text-[#74706B] dark:text-[#A09B94] hover:text-[#1F1E1D] dark:hover:text-[#FAF8F5]'
          }`}
        >
          History
        </button>
        <button
          id="nav-tab-profile"
          type="button"
          onClick={() => onTabChange('profile')}
          className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors cursor-pointer ${
            currentTab === 'profile'
              ? 'text-[#1F1E1D] dark:text-[#FAF8F5] bg-[#EFECE6] dark:bg-[#282522]'
              : 'text-[#74706B] dark:text-[#A09B94] hover:text-[#1F1E1D] dark:hover:text-[#FAF8F5]'
          }`}
        >
          Profile
        </button>
        {/* Placeholder slot preserved for upcoming Boards feature without cluttering */}
        <span className="hidden sm:inline-block w-4" aria-hidden="true" />
      </nav>
    </header>
  );
};
