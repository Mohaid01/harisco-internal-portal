import React, { createContext, useContext, useState, useCallback } from 'react';

interface LoadingContextType {
  setIsLoading: (loading: boolean) => void;
  withLoading: <T>(fn: () => Promise<T>) => Promise<T>;
}

const LoadingContext = createContext<LoadingContextType | undefined>(undefined);

export const LoadingProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activeRequests, setActiveRequests] = useState(0);

  const setIsLoading = useCallback((loading: boolean) => {
    setActiveRequests(prev => loading ? prev + 1 : Math.max(0, prev - 1));
  }, []);

  const withLoading = useCallback(async <T,>(fn: () => Promise<T>): Promise<T> => {
    setIsLoading(true);
    try {
      return await fn();
    } finally {
      setIsLoading(false);
    }
  }, [setIsLoading]);

  const isLoading = activeRequests > 0;

  return (
    <LoadingContext.Provider value={{ setIsLoading, withLoading }}>
      {children}
      {isLoading && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/20 backdrop-blur-[2px] transition-all animate-in fade-in duration-300">
          <div className="bg-white p-8 rounded-2xl shadow-2xl flex flex-col items-center gap-4 border border-slate-100 animate-in zoom-in-95 duration-200">
            <div className="relative">
              <div className="w-12 h-12 border-4 border-slate-100 border-t-harisco-blue rounded-full animate-spin"></div>
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-2 h-2 bg-harisco-blue rounded-full animate-pulse"></div>
              </div>
            </div>
            <div className="flex flex-col items-center">
              <p className="text-slate-900 font-bold tracking-tight">Processing</p>
              <p className="text-slate-400 text-[10px] font-medium uppercase tracking-widest mt-1">Please wait...</p>
            </div>
          </div>
        </div>
      )}
    </LoadingContext.Provider>
  );
};

export const useLoading = () => {
  const context = useContext(LoadingContext);
  if (!context) throw new Error('useLoading must be used within LoadingProvider');
  return context;
};
