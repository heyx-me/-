import React, { createContext, useContext, useState, useEffect, useRef } from "react";
import { useLocalStorageState } from "../hooks/useLocalStorageState.js";
import { useToast } from "./ToastContext.jsx";

const BankingContext = createContext(null);

export function BankingProvider({ children }) {
  const [token, setToken] = useLocalStorageState("banking_token", "");
  const [data, setData] = useLocalStorageState("banking_data", null);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  
  // UI State
  const [selectedAccountIndex, setSelectedAccountIndex] = useState(0);
  
  // OTP State
  const [otpNeeded, setOtpNeeded] = useState(false);
  const [otpValue, setOtpValue] = useState("");
  const [currentJobId, setCurrentJobId] = useState(null);

  const { showToast } = useToast();
  const pollIntervalRef = useRef(null);
  
  const mergeData = (prevData, newData) => {
      if (!prevData || !prevData.accounts) return newData;
      if (!newData || !newData.accounts) return prevData;

      const mergedAccounts = prevData.accounts.map(prevAcc => {
          const newAcc = newData.accounts.find(na => na.accountNumber === prevAcc.accountNumber);
          if (newAcc && newAcc.txns) {
              const txnMap = new Map();
              prevAcc.txns.forEach(t => txnMap.set(t.identifier || JSON.stringify(t), t));
              newAcc.txns.forEach(t => txnMap.set(t.identifier || JSON.stringify(t), t));
              
              const mergedTxns = Array.from(txnMap.values()).sort((a, b) => new Date(b.date) - new Date(a.date));
              return { ...prevAcc, ...newAcc, txns: mergedTxns };
          }
          return prevAcc;
      });

      const prevAccountNums = new Set(prevData.accounts.map(a => a.accountNumber));
      const addedAccounts = newData.accounts.filter(a => !prevAccountNums.has(a.accountNumber));

      return { ...newData, accounts: [...mergedAccounts, ...addedAccounts] };
  };

  // Computed: Sorted Accounts
  // Sort accounts so those with transactions come first
  const accounts = React.useMemo(() => {
      if (!data?.accounts) return [];
      return [...data.accounts].sort((a, b) => {
          const aHasTxns = a.txns && a.txns.length > 0;
          const bHasTxns = b.txns && b.txns.length > 0;
          if (aHasTxns && !bHasTxns) return -1;
          if (!aHasTxns && bHasTxns) return 1;
          return 0;
      });
  }, [data]);

  // 1. Handle OAuth Callback
  useEffect(() => {
      const urlParams = new URLSearchParams(window.location.search);
      const code = urlParams.get('code');
      
      if (code) {
          // Exchange code for token
          const exchangeToken = async () => {
              setLoading(true);
              setStatusMessage("Securely exchanging keys...");
              try {
                  const res = await fetch('/oauth/token', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                          grant_type: 'authorization_code',
                          code: code,
                          redirect_uri: window.location.origin + window.location.pathname,
                          client_id: 'rafi-client'
                      })
                  });
                  const json = await res.json();
                  if (json.error) throw new Error(json.error);
                  
                  setToken(json.access_token);
                  showToast("Login successful", "success");
                  
                  // Clean URL
                  window.history.replaceState({}, document.title, window.location.pathname);
              } catch (err) {
                  showToast("Login failed: " + err.message, "error");
              } finally {
                  setLoading(false);
                  setStatusMessage("");
              }
          };
          exchangeToken();
      }
  }, []);

  // Auto-refresh on init
  useEffect(() => {
      if (token && !data && !loading) {
          refreshData();
      }
  }, [token, data]);

  // Cleanup polling
  useEffect(() => {
      return () => {
          if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
      };
  }, []);

  const login = () => {
      const params = new URLSearchParams({
          response_type: 'code',
          client_id: 'rafi-client',
          redirect_uri: window.location.origin + window.location.pathname
      });
      window.location.href = `/oauth/authorize?${params.toString()}`;
  };

  const logout = () => {
    setToken("");
    setData(null); 
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
  };

  const startPolling = (jobId, isPagination = false) => {
      setCurrentJobId(jobId);
      setStatusMessage("Waiting for bank authentication...");
      
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);

      pollIntervalRef.current = setInterval(async () => {
          try {
              const res = await fetch(`/data/${jobId}`);
              const job = await res.json();

              if (job.status === 'WAITING_FOR_OTP') {
                  setOtpNeeded(true);
                  setStatusMessage("Two-factor authentication required...");
              } else if (job.status === 'COMPLETED') {
                  clearInterval(pollIntervalRef.current);
                  
                  if (isPagination) {
                      // Merge logic
                      let totalNewTxns = 0;
                      setData(prevData => {
                          const newAccounts = job.result.accounts || [];
                          const prevAccounts = prevData.accounts || [];
                          
                          const mergedAccounts = prevAccounts.map(prevAcc => {
                              const newAcc = newAccounts.find(na => na.accountNumber === prevAcc.accountNumber);
                              if (newAcc && newAcc.txns && newAcc.txns.length > 0) {
                                  const existingIdentifiers = new Set(prevAcc.txns.map(t => t.identifier ? t.identifier : JSON.stringify(t)));
                                  const newTxns = newAcc.txns.filter(t => {
                                      const key = t.identifier ? t.identifier : JSON.stringify(t);
                                      return !existingIdentifiers.has(key);
                                  });
                                  totalNewTxns += newTxns.length;
                                  return { ...prevAcc, txns: [...prevAcc.txns, ...newTxns] };
                              }
                              return prevAcc;
                          });
                          return { ...prevData, accounts: mergedAccounts };
                      });
                      
                      setLoadingMore(false);
                      if (totalNewTxns > 0) showToast(`Loaded ${totalNewTxns} older transactions`, "success");
                      else showToast("No older transactions found", "info");
                  } else {
                      setData(prevData => mergeData(prevData, job.result));
                      setLoading(false);
                      showToast("Account synced successfully", "success");
                  }

                  setOtpNeeded(false);
                  setCurrentJobId(null);
                  setStatusMessage("");
              } else if (job.status === 'FAILED') {
                  clearInterval(pollIntervalRef.current);
                  setLoading(false);
                  setLoadingMore(false);
                  setOtpNeeded(false);
                  setCurrentJobId(null);
                  setStatusMessage("");
                  showToast(`Sync failed: ${job.error}`, "error");
              }
          } catch (err) {
              console.error("Polling error:", err);
          }
      }, 2000); 
  };

  const refreshData = async () => {
    if (loading) return;
    setLoading(true);
    setStatusMessage("Connecting to bank...");
    
    // Fetch last 30 days initially
    const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    
    try {
      const res = await fetch(`/transactions?startDate=${encodeURIComponent(startDate)}`, {
          headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (res.status === 202) {
          const json = await res.json();
          startPolling(json.jobId);
          return;
      }
      
      if (!res.ok) {
          const json = await res.json();
          throw new Error(json.error || 'Fetch failed');
      }

      const result = await res.json();
      setData(prevData => mergeData(prevData, result));
      setLoading(false);
      setStatusMessage("");
      showToast("Account synced successfully", "success");

    } catch (err) {
      setLoading(false);
      setStatusMessage("");
      showToast(err.message, "error");
    }
  };
  
  const loadMore = async () => {
      if (loadingMore || loading || !data) return;
      
      let oldestDate = new Date();
      let hasTxns = false;
      
      data.accounts.forEach(acc => {
          acc.txns.forEach(txn => {
              const txnDate = new Date(txn.date);
              if (txnDate < oldestDate) {
                  oldestDate = txnDate;
                  hasTxns = true;
              }
          });
      });
      
      if (!hasTxns) return; 
      
      const targetEndDate = new Date(oldestDate);
      targetEndDate.setDate(1); 
      targetEndDate.setHours(0,0,0,0);
      
      const targetStartDate = new Date(targetEndDate);
      targetStartDate.setMonth(targetStartDate.getMonth() - 1); 
      
      setLoadingMore(true);
      showToast(`Fetching ${targetStartDate.toLocaleString('default', { month: 'long' })} history...`, "info");
      
      try {
        const res = await fetch(`/transactions?startDate=${encodeURIComponent(targetStartDate.toISOString())}&endDate=${encodeURIComponent(targetEndDate.toISOString())}`, {
             headers: { 'Authorization': `Bearer ${token}` }
        });

        if (res.status === 202) {
             const json = await res.json();
             startPolling(json.jobId, true);
             return;
        }

        if (!res.ok) {
            const json = await res.json();
            throw new Error(json.error);
        }

        const result = await res.json();
        
         let totalNewTxns = 0;
          setData(prevData => {
              const newAccounts = result.accounts || [];
              const prevAccounts = prevData.accounts || [];
              
              const mergedAccounts = prevAccounts.map(prevAcc => {
                  const newAcc = newAccounts.find(na => na.accountNumber === prevAcc.accountNumber);
                  if (newAcc && newAcc.txns && newAcc.txns.length > 0) {
                      const existingIdentifiers = new Set(prevAcc.txns.map(t => t.identifier ? t.identifier : JSON.stringify(t)));
                      const newTxns = newAcc.txns.filter(t => {
                          const key = t.identifier ? t.identifier : JSON.stringify(t);
                          return !existingIdentifiers.has(key);
                      });
                      totalNewTxns += newTxns.length;
                      return { ...prevAcc, txns: [...prevAcc.txns, ...newTxns] };
                  }
                  return prevAcc;
              });
              return { ...prevData, accounts: mergedAccounts };
          });
          setLoadingMore(false);
          if (totalNewTxns > 0) showToast(`Loaded ${totalNewTxns} older transactions`, "success");
          else showToast("No older transactions found", "info");

      } catch (err) {
        setLoadingMore(false);
        showToast(err.message, "error");
      }
  };

  const submitOtp = async (e) => {
      e.preventDefault();
      if (!currentJobId || !otpValue) return;

      try {
          const res = await fetch(`/data/${currentJobId}/otp`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ otp: otpValue })
          });
          const json = await res.json();
          if (json.error) throw new Error(json.error);

          setOtpNeeded(false);
          setOtpValue("");
          setStatusMessage("Verifying code...");
          showToast("Code submitted", "success");
      } catch (err) {
          showToast(err.message, "error");
      }
  };

  const value = {
      token,
      data,
      accounts,
      loading,
      loadingMore,
      statusMessage,
      selectedAccountIndex,
      setSelectedAccountIndex,
      otpNeeded,
      otpValue,
      setOtpValue,
      login,
      logout,
      refreshData,
      loadMore,
      submitOtp
  };

  return <BankingContext.Provider value={value}>{children}</BankingContext.Provider>;
}

export const useBanking = () => {
    const context = useContext(BankingContext);
    if (!context) {
        throw new Error("useBanking must be used within a BankingProvider");
    }
    return context;
};
