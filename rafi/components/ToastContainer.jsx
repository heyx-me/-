import React from "react";
import { useToast } from "../contexts/ToastContext.jsx";
import { Toast } from "./Toast.jsx";

// Toast container component - renders toasts
export function ToastContainer() {
  const { toasts, removeToast } = useToast();

  return (
    <div
      className="absolute bottom-6 left-6 z-[100] flex flex-col-reverse gap-2 pointer-events-none"
      style={{
        width: 'auto',
        maxWidth: 'calc(100vw - 3rem)',
      }}
    >
      {toasts.map(toast => (
        <Toast
          key={toast.id}
          message={toast.message}
          type={toast.type}
          onClose={() => removeToast(toast.id)}
        />
      ))}
    </div>
  );
}
