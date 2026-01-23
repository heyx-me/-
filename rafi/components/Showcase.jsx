import React, { useState } from "react";
import { useToast } from "../contexts/ToastContext.jsx";
import { useLocalStorageState } from "../hooks/index.js";

function Card({ title, children, className = "" }) {
  return (
    <div className={`bg-[var(--bg-primary)] p-6 rounded-xl border border-[var(--border-default)] shadow-sm ${className}`}>
      {title && <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-4">{title}</h3>}
      {children}
    </div>
  );
}

function Badge({ children, type = "default" }) {
  const styles = {
    default: "bg-[var(--bg-muted)] text-[var(--text-secondary)]",
    success: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300",
    blue: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  };
  return (
    <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${styles[type] || styles.default}`}>
      {children}
    </span>
  );
}

function CodeBlock({ code }) {
  return (
    <pre className="p-4 bg-[var(--bg-secondary)] rounded-lg overflow-x-auto text-sm font-mono text-[var(--text-secondary)] border border-[var(--border-muted)]">
      <code>{code}</code>
    </pre>
  );
}

export function Showcase() {
  const { addToast } = useToast();
  
  // Persistent State Demo
  const [note, setNote] = useLocalStorageState("demo_note", "");
  
  // Counter State (Local)
  const [count, setCount] = useState(0);

  const features = [
    {
      title: "Zero Build Step",
      description: "No Webpack, No Vite, No npm install. Just pure ES modules + Babel in the browser.",
      icon: (
        <svg className="w-6 h-6 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      )
    },
    {
      title: "React 19 Ready",
      description: "Uses the latest React 19 APIs including Hooks and Context.",
      icon: (
        <svg className="w-6 h-6 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
        </svg>
      )
    },
    {
      title: "Design System",
      description: "Tailwind CSS + CSS Variables for instant Dark Mode support.",
      icon: (
        <svg className="w-6 h-6 text-purple-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
        </svg>
      )
    }
  ];

  return (
    <div className="space-y-8 animate-slide-up pb-12">
      {/* Hero Section */}
      <section className="text-center space-y-4 py-8">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-300 text-sm font-medium mb-4">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
          </span>
          Now running React 19
        </div>
        <h1 className="text-4xl md:text-5xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-purple-600 dark:from-blue-400 dark:to-purple-400">
          Modern React Template
        </h1>
        <p className="text-lg text-[var(--text-secondary)] max-w-2xl mx-auto leading-relaxed">
          A lightweight, browser-based development environment. No build steps required. 
          Everything is transpiled on-the-fly via Service Worker.
        </p>
      </section>

      {/* Feature Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {features.map((feature, idx) => (
          <Card key={idx} className="hover:shadow-md transition-shadow">
            <div className="bg-[var(--bg-secondary)] w-12 h-12 rounded-lg flex items-center justify-center mb-4">
              {feature.icon}
            </div>
            <h3 className="text-lg font-semibold mb-2 text-[var(--text-primary)]">{feature.title}</h3>
            <p className="text-[var(--text-secondary)] text-sm leading-relaxed">{feature.description}</p>
          </Card>
        ))}
      </div>

      {/* Demos Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* Interactive UI Demo */}
        <Card title="Interactive UI Components" className="space-y-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-4 border-b border-[var(--border-muted)]">
              <div>
                <h4 className="font-medium text-[var(--text-primary)]">Toast Notifications</h4>
                <p className="text-sm text-[var(--text-secondary)]">Context-based notification system</p>
              </div>
              <div className="flex gap-2">
                <button 
                  onClick={() => addToast("Operation successful!", "success")}
                  className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-md transition-colors"
                  title="Success Toast"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </button>
                <button 
                  onClick={() => addToast("Something went wrong", "error")}
                  className="p-2 text-red-600 hover:bg-red-50 rounded-md transition-colors"
                  title="Error Toast"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
                <button 
                  onClick={() => addToast("Please review your settings", "warning")}
                  className="p-2 text-orange-600 hover:bg-orange-50 rounded-md transition-colors"
                  title="Warning Toast"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between pb-4 border-b border-[var(--border-muted)]">
              <div>
                <h4 className="font-medium text-[var(--text-primary)]">Counter State</h4>
                <p className="text-sm text-[var(--text-secondary)]">Simple useState hook example</p>
              </div>
              <div className="flex items-center gap-3 bg-[var(--bg-secondary)] rounded-lg p-1">
                <button 
                  onClick={() => setCount(c => c - 1)}
                  className="w-8 h-8 flex items-center justify-center rounded bg-white dark:bg-black shadow-sm hover:bg-gray-50 dark:hover:bg-gray-900 text-[var(--text-primary)]"
                >
                  -
                </button>
                <span className="w-8 text-center font-mono font-medium text-[var(--text-primary)]">{count}</span>
                <button 
                  onClick={() => setCount(c => c + 1)}
                  className="w-8 h-8 flex items-center justify-center rounded bg-white dark:bg-black shadow-sm hover:bg-gray-50 dark:hover:bg-gray-900 text-[var(--text-primary)]"
                >
                  +
                </button>
              </div>
            </div>
          </div>
        </Card>

        {/* Local Storage Demo */}
        <Card title="Persistence Hook" className="space-y-4">
          <p className="text-sm text-[var(--text-secondary)]">
            This input uses <code className="text-xs bg-[var(--bg-secondary)] px-1 py-0.5 rounded border border-[var(--border-muted)]">useLocalStorageState</code>.
            Try typing something and refreshing the page.
          </p>
          
          <div className="space-y-2">
            <label className="text-xs font-medium uppercase text-[var(--text-muted)] tracking-wider">Saved Note</label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Type something to save..."
              className="w-full h-32 px-4 py-3 bg-[var(--bg-secondary)] border border-[var(--border-muted)] rounded-lg text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)] focus:border-transparent resize-none transition-all"
            />
            <div className="flex justify-between items-center text-xs text-[var(--text-muted)]">
              <span>Auto-saves after 1s delay</span>
              {note && <span>{note.length} characters</span>}
            </div>
          </div>
        </Card>
      </div>

      {/* Developer Quickstart */}
      <Card title="Quick Start Guide">
        <div className="space-y-4">
          <p className="text-[var(--text-secondary)]">
            To start building your app, edit <code className="text-[var(--accent-primary)]">app.jsx</code> or create new components in the <code className="text-[var(--accent-primary)]">components/</code> directory.
          </p>
          <CodeBlock code={`// Example: Create a new component
import React from "react";

export function MyComponent() {
  return (
    <div className="p-4 bg-white rounded shadow">
      Hello World
    </div>
  );
}`} />
        </div>
      </Card>
    </div>
  );
}
