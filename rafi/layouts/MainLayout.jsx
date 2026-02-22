import React from "react";
import { Header, ToastContainer, RefreshContainer } from "../components/index.jsx";

export function MainLayout({ children }) {
  return (
    <div className="flex flex-col h-full bg-[var(--bg-secondary)] overflow-hidden">
      <Header />
      <RefreshContainer>
        {children}
      </RefreshContainer>
      <ToastContainer />
    </div>
  );
}
