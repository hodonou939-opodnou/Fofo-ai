"use client";

import { createContext, useCallback, useContext, useState, type ReactNode } from "react";

type Toast = { id: number; message: string; tone: "info" | "success" | "error" };
type ToastApi = { show: (message: string, tone?: Toast["tone"]) => void };

const ToastContext = createContext<ToastApi>({ show: () => {} });

export function useToast() {
  return useContext(ToastContext);
}

let nextId = 1;

// Short, plain confirmations ("Lien copié") and errors, announced politely.
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const show = useCallback((message: string, tone: Toast["tone"] = "info") => {
    const id = nextId++;
    setToasts((all) => [...all, { id, message, tone }]);
    setTimeout(() => setToasts((all) => all.filter((t) => t.id !== id)), 3500);
  }, []);

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-36 z-[60] flex flex-col items-center gap-2 px-4 md:bottom-28"
      >
        {toasts.map((t) => (
          <p
            key={t.id}
            role={t.tone === "error" ? "alert" : "status"}
            className={[
              "rounded-full border px-4 py-2.5 text-sm shadow-lift",
              t.tone === "error"
                ? "border-danger/40 bg-soot text-danger"
                : t.tone === "success"
                  ? "border-gold/40 bg-soot text-gold-light"
                  : "border-ember bg-soot text-ivory",
            ].join(" ")}
          >
            {t.message}
          </p>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
