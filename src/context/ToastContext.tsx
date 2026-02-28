"use client";

import React, { createContext, useContext, useState, useCallback } from "react";
import { FaCheckCircle, FaExclamationTriangle, FaInfoCircle } from "react-icons/fa";

type ToastType = 'success' | 'error' | 'info';

interface Toast {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastContextType {
  showToast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback((message: string, type: ToastType = 'info') => {
    const id = Math.random().toString(36).slice(2, 9);
    setToasts((prev) => [...prev, { id, message, type }]);
    
    // Auto remove after 3 seconds
    setTimeout(() => {
      removeToast(id);
    }, 3000);
  }, [removeToast]);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      
      {/* Toast Container */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-99999 flex flex-col gap-3 pointer-events-none">
        {toasts.map((toast) => (
          <div 
            key={toast.id}
            className="animate-bounce-in pointer-events-auto"
          >
            <div className={`px-6 py-3 rounded-2xl shadow-xl border flex items-center gap-3 min-w-[300px] backdrop-blur-md transition-all hover:scale-105 ${
              toast.type === 'success' ? 'bg-green-50/95 border-green-200 text-green-800 shadow-green-100/50' :
              toast.type === 'error' ? 'bg-red-50/95 border-red-200 text-red-800 shadow-red-100/50' :
              'bg-blue-50/95 border-blue-200 text-blue-800 shadow-blue-100/50'
            }`}>
              {toast.type === 'success' && <FaCheckCircle className="text-xl shrink-0 text-green-500" />}
              {toast.type === 'error' && <FaExclamationTriangle className="text-xl shrink-0 text-red-500" />}
              {toast.type === 'info' && <FaInfoCircle className="text-xl shrink-0 text-blue-500" />}
              <span className="font-semibold">{toast.message}</span>
            </div>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
};
