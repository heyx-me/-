import React from "react";
import { Header, ToastContainer } from "../components/index.jsx";

export function MainLayout({ children }) {
  return (
    <div className="flex flex-col h-full bg-[var(--bg-secondary)]">
      <Header />
      <main className="flex-1 overflow-auto relative p-4">
        <div className="max-w-4xl mx-auto">
          {children}
        </div>
      </main>
      <ToastContainer />
    </div>
  );
}
