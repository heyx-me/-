import React, { createContext, useContext, useState, useEffect, useRef } from "react";
import { useLocalStorageState } from "../hooks/useLocalStorageState.js";
import { useToast } from "./ToastContext.jsx";
import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL, SUPABASE_KEY } from "../config.js";
import { BANK_DEFINITIONS } from "../utils/bankDefinitions.js";
import { v4 as uuidv4 } from "uuid";
import JSEncrypt from "jsencrypt";

const BankingContext = createContext(null);

export function BankingProvider({ children }) {
  const [token, setToken] = useLocalStorageState("banking_token", "");
  const [data, setData] = useLocalStorageState("banking_data", null);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState(null);
  const companies = BANK_DEFINITIONS;
  
  // UI State
  const [selectedAccountIndex, setSelectedAccountIndex] = useState(0);
  const [showLoginModal, setShowLoginModal] = useState(false);
  
  // OTP State
  const [otpNeeded, setOtpNeeded] = useState(false);
  const [otpValue, setOtpValue] = useState("");
  const [currentJobId, setCurrentJobId] = useState(null);

  // Supabase State
  const [supabase, setSupabase] = useState(null);
  const [conversationId, setConversationId] = useLocalStorageState("rafi_conversation_id", "");
  const processedMessageIds = useRef(new Set());

  const { showToast } = useToast();

  // Initialize Supabase
  useEffect(() => {
    console.log("[BankingContext] Init Supabase...", { URL: SUPABASE_URL, KEY_LEN: SUPABASE_KEY?.length });
    if (SUPABASE_URL && SUPABASE_KEY) {
      try {
        const client = createClient(SUPABASE_URL, SUPABASE_KEY);
        console.log("[BankingContext] Supabase client created:", !!client);
        setSupabase(client);
      } catch (e) {
        console.error("Supabase init failed:", e);
      }
    } else {
        console.error("[BankingContext] Missing Supabase config");
    }
  }, []);

  // Ensure Conversation ID
  useEffect(() => {
    if (!conversationId) {
      let newId;
      try {
          newId = uuidv4();
      } catch (e) {
          console.error("UUID gen failed, using fallback", e);
      }
      
      if (!newId) {
          newId = 'fallback-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
      }

      console.log(`[BankingContext] Generating new Conversation ID: ${newId}`);
      setConversationId(newId);
    } else {
        console.log(`[BankingContext] Conversation ID ready: ${conversationId}`);
    }
  }, [conversationId, setConversationId]);

  // Subscribe to Messages
  useEffect(() => {
    if (!supabase || !conversationId) return;

    console.log(`[BankingContext] Subscribing to conversation: ${conversationId}`);

    const processMsg = (msg, isUpdate = false) => {
        if (!isUpdate && processedMessageIds.current.has(msg.id)) return;
        if (!isUpdate) processedMessageIds.current.add(msg.id);
        handleIncomingMessage(msg);
    };

    const channel = supabase.channel(`room:rafi:${conversationId}`)
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'messages',
        filter: `conversation_id=eq.${conversationId}`
      }, (payload) => {
        if (payload.eventType === 'INSERT') {
            processMsg(payload.new, false);
        } else if (payload.eventType === 'UPDATE') {
            processMsg(payload.new, true);
        }
      })
      .subscribe((status) => {
          console.log(`[BankingContext] Subscription status: ${status}`);
      });

    // Fallback polling
    const interval = setInterval(async () => {
        // Fetch recent bot messages
        const { data: msgs } = await supabase
            .from('messages')
            .select('*')
            .eq('conversation_id', conversationId)
            .eq('is_bot', true)
            .order('created_at', { ascending: false }) // Fetch latest
            .limit(10);
        
        if (msgs) {
            // Process latest first or oldest first? 
            // It doesn't matter much for state updates usually, but oldest->newest is safer.
            // msgs is desc, so reverse to process in chronological order
            [...msgs].reverse().forEach(processMsg);
        }
    }, 3000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, [supabase, conversationId]);

  const sendMessage = async (payload) => {
    if (!supabase || !conversationId) return;
    
    // If payload is object, add action if missing? No, assume caller handles structure.
    // Wrap in JSON string
    const content = JSON.stringify(payload);
    console.log("[BankingContext] Sending message:", content);

    const { error } = await supabase.from('messages').insert({
        room_id: 'rafi',
        conversation_id: conversationId,
        content: content,
        sender_id: conversationId, // User acts as the conversation ID for now
        is_bot: false
    });
    
    if (error) console.error("[BankingContext] Send error:", error);
  };

  const handleIncomingMessage = (msg) => {
    if (!msg.is_bot) return;

    try {
      const payload = JSON.parse(msg.content);
      if (!payload.type) return; // Ignore non-protocol messages

      console.log(`[BankingContext] Received message type: ${payload.type}`, payload);

      switch (payload.type) {
        case 'WELCOME':
            setStatusMessage(payload.text);
            break;
        case 'STATUS':
            setStatusMessage(payload.text);
            setLoading(true);
            break;
        case 'OTP_REQUIRED':
            setOtpNeeded(true);
            setCurrentJobId(payload.jobId);
            setStatusMessage("Enter One-Time Password sent to your device.");
            setLoading(false);
            break;
        case 'AUTH_URL_READY':
            // Received URL & Public Key, now encrypt and send
            if (pendingCredentials.current) {
                const { companyId, credentials } = pendingCredentials.current;
                const url = payload.url;
                const publicKey = payload.publicKey;
                
                // Clear pending
                pendingCredentials.current = null;
                
                // Encrypt payload
                const encryptor = new JSEncrypt();
                encryptor.setPublicKey(publicKey);
                const payloadStr = JSON.stringify({ companyId, credentials });
                const encryptedData = encryptor.encrypt(payloadStr);
                
                if (!encryptedData) {
                    setLoading(false);
                    showToast("Encryption failed", "error");
                    return;
                }

                // Post to agent
                fetch(url, {
                    method: 'POST',
                    headers: { 
                        'Content-Type': 'application/json',
                        'Bypass-Tunnel-Reminder': 'true'
                    },
                    body: JSON.stringify({ conversationId, encryptedData })
                })
                .then(async (res) => {
                    if (!res.ok) {
                        const text = await res.text();
                        throw new Error(`Agent Error: ${res.status} ${text}`);
                    }
                })
                .catch(err => {
                    setLoading(false);
                    showToast(`Connection Failed: ${err.message}`, "error");
                    console.error(err);
                });
            }
            break;
        case 'LOGIN_SUCCESS':
            setToken(payload.token);
            if (payload.data) {
                mergeData(null, payload.data); // Reset data on new login
                setData(payload.data);
            }
            setLoading(false);
            setOtpNeeded(false);
            setShowLoginModal(false);
            setStatusMessage("");
            showToast("Login Successful", "success");
            break;
        case 'DATA':
            // Handle pagination vs full sync
            // For now assume full sync or handled by caller logic?
            // The agent sends { type: 'DATA', data: ... }
            if (loadingMore) {
                // Pagination merge logic
                handlePaginationMerge(payload.data);
                setLoadingMore(false);
            } else {
                setData(prev => mergeData(prev, payload.data));
                setLoading(false);
            }
            setOtpNeeded(false);
            setStatusMessage("");
            showToast("Data Synced", "success");
            break;
        case 'ERROR':
            setStatusMessage("");
            setErrorMessage(payload.error || "Unknown Error");
            setLoading(false);
            setLoadingMore(false);
            setOtpNeeded(false);
            showToast(payload.error || "Unknown Error", "error");
            break;
      }
    } catch (e) {
      // console.log("Not a JSON message:", msg.content);
    }
  };

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

  const handlePaginationMerge = (newData) => {
      let totalNewTxns = 0;
      setData(prevData => {
          const newAccounts = newData.accounts || [];
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
      if (totalNewTxns > 0) showToast(`Loaded ${totalNewTxns} older transactions`, "success");
      else showToast("No older transactions found", "info");
  };

  // Computed: Sorted Accounts
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

  // Actions
  const login = () => {
     setShowLoginModal(true);
  };

  const pendingCredentials = useRef(null);

  const performLogin = async (companyId, credentials) => {
      setLoading(true);
      setErrorMessage(null);
      setStatusMessage("Requesting secure channel...");
      
      // Store creds temporarily in ref (memory only)
      pendingCredentials.current = { companyId, credentials };

      await sendMessage({
          action: 'REQUEST_AUTH_URL'
      });
  };

  const logout = () => {
    setToken("");
    setData(null); 
    setConversationId(uuidv4()); // Reset conversation on logout
  };

  const refreshData = async () => {
    if (loading) return;
    setLoading(true);
    setStatusMessage("Requesting sync...");
    
    await sendMessage({
        action: 'FETCH',
        token,
        startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
    });
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
      
      await sendMessage({
          action: 'FETCH',
          token,
          startDate: targetStartDate.toISOString(),
          endDate: targetEndDate.toISOString()
      });
  };

  const submitOtp = async (e) => {
      e.preventDefault();
      if (!currentJobId || !otpValue) return;

      setStatusMessage("Submitting OTP...");
      await sendMessage({
          action: 'SUBMIT_OTP',
          jobId: currentJobId,
          otp: otpValue
      });
      setOtpValue("");
      // Don't close OTP modal yet, wait for result? 
      // Actually OTP modal is controlled by otpNeeded. 
      // Wait for agent to say "SUCCESS" or "RUNNING" or "DATA".
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
      submitOtp,
      showLoginModal,
      setShowLoginModal,
      performLogin,
      companies,
      errorMessage
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
