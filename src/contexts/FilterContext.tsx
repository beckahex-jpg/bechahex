import { createContext, useContext, useState, ReactNode } from 'react';

interface FilterContextType {
  showFilters: boolean;
  toggleFilters: () => void;
  resetCategoryTrigger: number;
  triggerResetCategory: () => void;
}

const FilterContext = createContext<FilterContextType | undefined>(undefined);

export function FilterProvider({ children }: { children: ReactNode }) {
  const [showFilters, setShowFilters] = useState(false);
  const [resetCategoryTrigger, setResetCategoryTrigger] = useState(0);

  const toggleFilters = () => {
    setShowFilters((prev) => !prev);
  };

  const triggerResetCategory = () => {
    setResetCategoryTrigger((prev) => prev + 1);
  };

  return (
    <FilterContext.Provider value={{ showFilters, toggleFilters, resetCategoryTrigger, triggerResetCategory }}>
      {children}
    </FilterContext.Provider>
  );
}

export function useFilters() {
  const context = useContext(FilterContext);
  if (context === undefined) {
    throw new Error('useFilters must be used within a FilterProvider');
  }
  return context;
}
