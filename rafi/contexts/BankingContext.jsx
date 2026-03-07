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
  // Extract IDs from URL first
  const urlParams = new URLSearchParams(window.location.search);
  const cidFromUrl = urlParams.get('cid');
  const uidFromUrl = urlParams.get('uid');

  const [conversationId, setConversationId] = useLocalStorageState("rafi_conversation_id", cidFromUrl || (() => uuidv4()));
  const [userId, setUserId] = useLocalStorageState("rafi_user_id", uidFromUrl || (() => uuidv4()));

  // Scope data and tokens by conversation ID to avoid data sharing between threads
  const [tokens, setTokens] = useLocalStorageState(conversationId ? `banking_tokens_${conversationId}` : "banking_tokens", []);
  const [data, setData] = useLocalStorageState(conversationId ? `banking_data_${conversationId}` : "banking_data", null);
  const [loading, setLoading] = useState(false);

  // Migration from old single token and unscoped tokens
  useEffect(() => {
    // 1. Old single token migration
    const oldToken = localStorage.getItem("banking_token");
    if (oldToken && tokens.length === 0) {
      try {
        const parsed = JSON.parse(oldToken);
        if (parsed && typeof parsed === 'string') {
          setTokens([parsed]);
          localStorage.removeItem("banking_token");
        }
      } catch (e) {
        if (typeof oldToken === 'string' && oldToken.length > 10) {
            setTokens([oldToken]);
            localStorage.removeItem("banking_token");
        }
      }
    }

    // 2. Migration from unscoped "banking_tokens" if conversationId just became available
    if (conversationId && tokens.length === 0) {
        const unscopedTokens = localStorage.getItem("banking_tokens");
        if (unscopedTokens) {
            try {
                const parsed = JSON.parse(unscopedTokens);
                if (Array.isArray(parsed) && parsed.length > 0) {
                    setTokens(parsed);
                    localStorage.removeItem("banking_tokens");
                }
            } catch (e) {}
        }

        const unscopedData = localStorage.getItem("banking_data");
        if (unscopedData && !data) {
            try {
                const parsed = JSON.parse(unscopedData);
                if (parsed) {
                    setData(parsed);
                    localStorage.removeItem("banking_data");
                }
            } catch (e) {}
        }
    }
  }, [tokens, setTokens, conversationId, data, setData]);

  const [loadingMore, setLoadingMore] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState(null);
  const [lastSyncTime, setLastSyncTime] = useLocalStorageState(conversationId ? `rafi_last_sync_${conversationId}` : "rafi_last_sync", null, { debounceMs: 0 });
  const loadingTimerRef = useRef(null);
  const loadingStartedAt = useRef(0);
  const MIN_LOADING_TIME = 1500; // 1.5s for "realism" and smooth animation
  const LOADING_TIMEOUT = 300000; // 5 minutes max (matching agent OTP timeout)

  const companies = BANK_DEFINITIONS;
  
  // Custom setLoading that handles the minimum time and timeouts
  const updateLoading = (val, isMore = false, silent = false) => {
    if (val) {
        // Start loading
        if (isMore) setLoadingMore(true);
        else setLoading(true);
        loadingStartedAt.current = Date.now();
        
        // Clear previous timeout if any
        if (loadingTimerRef.current) clearTimeout(loadingTimerRef.current);
        
        // Set a safety timeout
        loadingTimerRef.current = setTimeout(() => {
            console.warn("[BankingContext] Loading timed out");
            setLoading(false);
            setLoadingMore(false);
            setStatusMessage("");
            if (!silent) showToast("Sync timed out. Please try again.", "error");
        }, LOADING_TIMEOUT);
    } else {
        // End loading
        const now = Date.now();
        const elapsed = now - loadingStartedAt.current;
        const remaining = Math.max(0, MIN_LOADING_TIME - elapsed);
        
        setTimeout(() => {
            if (loadingTimerRef.current) {
                clearTimeout(loadingTimerRef.current);
                loadingTimerRef.current = null;
            }
            
            // Only update sync time if we didn't time out or error out
            if (!errorMessage) {
                setLastSyncTime(new Date().toISOString());
            }
            
            setLoading(false);
            setLoadingMore(false);
        }, silent ? 0 : remaining);
    }
  };
  
  // UI State
  const [selectedAccountIndex, setSelectedAccountIndex] = useState(0);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [selectedMonthId, setSelectedMonthId] = useState(null);
  
  // OTP State
  const [otpNeeded, setOtpNeeded] = useState(false);
  const [otpValue, setOtpValue] = useState("");
  const [currentJobId, setCurrentJobId] = useState(null);
  const [secureChannelReady, setSecureChannelReady] = useState(false);
  const [secureParams, setSecureParams] = useState(null);

  const processedMessages = useRef(new Map()); // id -> content hash

  // Supabase State
  const [supabase, setSupabase] = useState(null);

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

  // Handle recovery from history and cleanup on mount
  useEffect(() => {
    if (!supabase || !conversationId) return;

    const initAndCleanup = async () => {
        console.log("[BankingContext] Initializing and cleaning up history...");
        
        // 1. Fetch recent messages for state recovery
        const { data: msgs } = await supabase
            .from('messages')
            .select('*')
            .eq('conversation_id', conversationId)
            .eq('is_bot', true)
            .order('created_at', { ascending: false })
            .limit(20);
        
        if (msgs && msgs.length > 0) {
            // Process in chronological order to reach current state
            const sortedMsgs = [...msgs].reverse();
            
            // We want to update state but skip "MIN_LOADING_TIME" delays and Toasts during recovery
            sortedMsgs.forEach(msg => {
                const contentStr = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content);
                if (processedMessages.current.get(msg.id) === contentStr) return;
                processedMessages.current.set(msg.id, contentStr);
                handleIncomingMessage(msg, true); // true = silent recovery
            });
        }

        // 2. Global cleanup of "stuck" ephemeral messages (Hydrate & Destroy sweep)
        const isDebug = typeof localStorage !== 'undefined' && localStorage.getItem('debug_mode') === 'true';
        if (!isDebug) {
            try {
                const { data: leftovers } = await supabase
                    .from('messages')
                    .select('id, content, created_at')
                    .eq('conversation_id', conversationId);

                if (leftovers) {
                    for (const msg of leftovers) {
                        try {
                            const content = typeof msg.content === 'string' ? JSON.parse(msg.content) : msg.content;
                            // Delete if it's marked ephemeral OR is a protocol message type
                            // BUT DO NOT delete user actions like GET_STATE or FETCH that the agent still needs to see
                            // AND DO NOT delete DATA messages as they are needed for state sync in shared conversations
                            const isUserAction = !msg.is_bot && content.action;
                            const isStateData = content.type === 'DATA';
                            if (!isUserAction && !isStateData && (content.ephemeral || ['STATUS', 'SYSTEM', 'ERROR', 'UI_COMMAND', 'WELCOME', 'OTP_REQUIRED', 'AUTH_URL_READY', 'LOGIN_SUCCESS'].includes(content.type))) {
                                // Add a 2 minute grace period for protocol messages to allow other participants to sync
                                const age = Date.now() - new Date(msg.created_at).getTime();
                                if (age > 120000) {
                                    await supabase.from('messages').delete().eq('id', msg.id);
                                }
                            }
                        } catch (e) {
                            // Not a JSON message or different structure, skip
                        }
                    }
                }
            } catch (e) {
                console.error("[BankingContext] Cleanup failed:", e);
            }
        }
    };

    initAndCleanup();
  }, [supabase, conversationId]);

  // Request state if data is missing (handles joining shared conversations)
  const stateRequested = useRef(null); // Track WHICH conversation we requested state for
  useEffect(() => {
    // Only request if we are definitely empty and not already loading/requesting for THIS id
    if (supabase && conversationId && !data && !loading && stateRequested.current !== conversationId) {
        stateRequested.current = conversationId;
        console.log("[BankingContext] Requesting state from agent for conversation:", conversationId);
        
        // Small delay to allow any immediate history recovery to process first
        const timer = setTimeout(() => {
            // If data is still missing after history recovery, ask the agent
            if (!data) {
                sendMessage({ action: 'GET_STATE' });
            }
        }, 1000);
        return () => clearTimeout(timer);
    }
  }, [supabase, conversationId, !!data, loading]);

  const { showToast } = useToast();

  // Ensure IDs stay in sync with URL if it changes
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const cid = params.get('cid');
    const uid = params.get('uid');

    if (cid && cid !== conversationId) {
        setConversationId(cid);
    }
    if (uid && uid !== userId) {
        setUserId(uid);
    }

    if (!conversationId && !cid) {
        setConversationId(uuidv4());
    }
  }, [conversationId, userId]);

  // Subscribe to Messages
  useEffect(() => {
    if (!supabase || !conversationId) return;

    console.log(`[BankingContext] Subscribing to conversation: ${conversationId}`);

    const processMsg = (msg) => {
        // If we've seen this exact content for this ID, skip
        const prevContent = processedMessages.current.get(msg.id);
        if (prevContent === msg.content) return;
        
        console.log(`[BankingContext] Processing message ${msg.id} (content changed):`, msg.content.substring(0, 100));
        processedMessages.current.set(msg.id, msg.content);
        handleIncomingMessage(msg);
    };

    const channel = supabase.channel(`room:rafi:${conversationId}`)
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'messages',
        filter: `conversation_id=eq.${conversationId}`
      }, (payload) => {
        if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            processMsg(payload.new);
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
            // Process in chronological order
            [...msgs].reverse().forEach(processMsg);
        }
    }, 3000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, [supabase, conversationId]);

  // Listen for secure transmit events from parent Heyx layer
  useEffect(() => {
    const handleMessage = (e) => {
        if (e.data && e.data.type === 'HEYX_SECURE_TRANSMIT') {
            const payload = e.data.payload;
            console.log("[BankingContext] Secure transmit request from parent:", payload);
            
            if (secureChannelReady && window._rafi_secure) {
                const encryptor = new JSEncrypt();
                encryptor.setPublicKey(window._rafi_secure.publicKey);
                
                let dataToEncrypt;
                
                // Case 1: Payload is already structured (from InteractiveInputBubble)
                if (typeof payload === 'object' && !payload.text) {
                    // Map fields based on current secureParams context
                    if (secureParams?.type === 'password') {
                        // Extract bank/provider if present in payload or use params
                        const companyId = payload.bank || secureParams.provider || 'hapoalim';
                        // The rest of payload are credentials
                        const { bank, ...credentials } = payload;
                        dataToEncrypt = { companyId, credentials };
                    } else if (secureParams?.type === 'otp') {
                        // Extract first key that looks like OTP
                        const otpKey = Object.keys(payload).find(k => k.toLowerCase().includes('otp') || k.toLowerCase().includes('code')) || Object.keys(payload)[0];
                        dataToEncrypt = { action: 'SUBMIT_OTP', jobId: currentJobId, otp: String(payload[otpKey]).replace(/\D/g, '') };
                    } else {
                        dataToEncrypt = { ...payload, context: secureParams };
                    }
                } 
                // Case 2: Legacy raw text payload (fallback)
                else {
                    const text = payload.text;
                    if (secureParams?.type === 'password') {
                        dataToEncrypt = { 
                            companyId: secureParams.provider || 'hapoalim', 
                            credentials: { password: text } 
                        };
                    } else if (secureParams?.type === 'otp') {
                        dataToEncrypt = { action: 'SUBMIT_OTP', jobId: currentJobId, otp: text.replace(/\D/g, '') };
                    }
                }

                if (dataToEncrypt) {
                    const payloadStr = JSON.stringify(dataToEncrypt);
                    const encryptedData = encryptor.encrypt(payloadStr);
                    
                    if (!encryptedData) {
                        console.error("[BankingContext] Encryption failed. Data might be too large.");
                        showToast("Transmission failed: payload too large", "error");
                        return;
                    }

                    fetch(window._rafi_secure.url, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'Bypass-Tunnel-Reminder': 'true' },
                        body: JSON.stringify({ conversationId, encryptedData })
                    }).then(res => {
                        if (res.ok) {
                            showToast("Data sent securely", "success");
                            setSecureChannelReady(false);
                            setSecureParams(null);
                        }
                    });
                }
            } else {
                console.warn("[BankingContext] Secure channel not ready for transmit");
                showToast("Secure channel error", "error");
            }
        }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [secureChannelReady, secureParams, conversationId, currentJobId]);

  const sendMessage = async (payload) => {
    if (!supabase || !conversationId) return;
    
    // Ensure conversation exists to satisfy FK
    if (userId) {
        const { error: convoError } = await supabase.from('conversations').upsert({ 
            id: conversationId, 
            title: 'Rafi Chat',
            owner_id: userId,
            updated_at: new Date().toISOString()
        }, { onConflict: 'id', ignoreDuplicates: true });
        
        if (convoError) console.error("[BankingContext] Conversation upsert error:", convoError);
    }
    
    // If payload is object, add action if missing? No, assume caller handles structure.
    // Wrap in JSON string
    const debug = typeof localStorage !== 'undefined' && localStorage.getItem('debug_mode') === 'true';
    const content = JSON.stringify({ ...payload, ephemeral: true, debug });
    console.log("[BankingContext] Sending message:", content);

    const { error } = await supabase.from('messages').insert({
        room_id: 'rafi',
        conversation_id: conversationId,
        content: content,
        sender_id: userId, 
        is_bot: false
    });
    
    if (error) {
        console.error("[BankingContext] Send error:", error);
        updateLoading(false);
        setStatusMessage("");
        showToast("Failed to send request. Check your connection.", "error");
    }
  };

  const handleIncomingMessage = (msg, silent = false) => {
    if (!msg.is_bot) return;

    // Check if message is recent (within last 5 minutes) to avoid spamming toasts on history load
    const isRecent = !silent && (Date.now() - new Date(msg.created_at).getTime()) < 300000;

    try {
      const payload = JSON.parse(msg.content);
      if (!payload.type) return; // Ignore non-protocol messages

      console.log(`[BankingContext] Received message type: ${payload.type}`, payload);

      switch (payload.type) {
        case 'UI_COMMAND':
            console.log("[BankingContext] UI Command received:", payload.command, payload.params);
            if (payload.command === 'SHOW_LOGIN') {
                setShowLoginModal(true);
            } else if (payload.command === 'REFRESH_DATA') {
                refreshData();
            } else if (payload.command === 'PREPARE_SECURE_CHANNEL') {
                setSecureParams(payload.params);
                if (!secureChannelReady) {
                    sendMessage({ action: 'REQUEST_AUTH_URL' });
                }
            }
            break;
        case 'REQUEST_INPUT':
            // We rely on PREPARE_SECURE_CHANNEL command instead of auto-triggering here
            // to avoid race conditions with multiple key generation requests.
            break;
        case 'WELCOME':
            setStatusMessage(payload.text);
            break;
        case 'STATUS':
            setStatusMessage(payload.text);
            updateLoading(true, false, silent);
            // DO NOT delete status messages as they might be updated by the agent (e.g. to OTP_REQUIRED)
            break;
        case 'OTP_REQUIRED':
            setOtpNeeded(true);
            setShowLoginModal(false); // Hide login modal if OTP is needed
            setCurrentJobId(payload.jobId);
            setStatusMessage("Enter One-Time Password sent to your device.");
            setLoading(false); // Force close loader immediately
            setLoadingMore(false);
            break;
        case 'AUTH_URL_READY':
            // Received URL & Public Key, store for later use
            setSecureChannelReady(true);
            window._rafi_secure = {
                url: payload.url,
                publicKey: payload.publicKey
            };
            
            // If we have pending credentials (from modal), send them now
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
                    updateLoading(false, false, silent);
                    if (isRecent) showToast("Encryption failed", "error");
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
                    updateLoading(false, false, silent);
                    setErrorMessage(`Connection Failed: ${err.message}`);
                    if (isRecent) showToast(`Connection Failed: ${err.message}`, "error");
                    console.error(err);
                });
            }
            break;
        case 'LOGIN_SUCCESS':
            if (payload.token) {
                setTokens(prev => {
                    const newTokens = [...prev];
                    if (!newTokens.includes(payload.token)) {
                        newTokens.push(payload.token);
                    }
                    return newTokens;
                });
            }
            
            if (payload.data) {
                setData(prev => mergeData(prev, payload.data));
            }
            updateLoading(false, false, silent);
            setOtpNeeded(false);
            setSecureChannelReady(false);
            setSecureParams(null);
            setShowLoginModal(false);
            setStatusMessage("");
            if (isRecent) showToast("Login Successful", "success");
            break;
        case 'DATA':
            // Handle pagination vs full sync
            // For now assume full sync or handled by caller logic?
            // The agent sends { type: 'DATA', data: ... }
            if (loadingMore) {
                // Pagination merge logic
                handlePaginationMerge(payload.data);
                updateLoading(false, true, silent);
            } else {
                setData(prev => mergeData(prev, payload.data));
                updateLoading(false, false, silent);
            }
            setSecureChannelReady(false);
            setSecureParams(null);
            setOtpNeeded(false);
            setStatusMessage("");
            if (isRecent) showToast("Data Synced", "success");
            
            // On recovery, ensure lastSyncTime is updated from message timestamp if available
            if (silent && msg.created_at) {
                setLastSyncTime(msg.created_at);
            }
            break;
        case 'ERROR':
            setStatusMessage("");
            setErrorMessage(payload.error || "Unknown Error");
            updateLoading(false, false, silent);
            setOtpNeeded(false);
            if (isRecent) showToast(payload.error || "Unknown Error", "error");
            break;
      }
    } catch (e) {
      // console.log("Not a JSON message:", msg.content);
    }
  };

  const mergeData = (prevData, newData) => {
      if (!prevData || !prevData.accounts) return newData;
      if (!newData || !newData.accounts) return prevData;

      // Map to track accounts by number
      const accountMap = new Map();
      
      // Add existing accounts
      prevData.accounts.forEach(acc => accountMap.set(acc.accountNumber, { ...acc }));
      
      // Merge/Add new accounts
      newData.accounts.forEach(newAcc => {
          const existingAcc = accountMap.get(newAcc.accountNumber);
          if (existingAcc) {
              // Merge transactions
              const txnMap = new Map();
              // Use unique key: identifier OR (date+amount+description)
              const getTxnKey = (t) => t.identifier || `${t.date}_${t.chargedAmount}_${t.description}`;

              if (existingAcc.txns) existingAcc.txns.forEach(t => txnMap.set(getTxnKey(t), t));
              if (newAcc.txns) newAcc.txns.forEach(t => txnMap.set(getTxnKey(t), t));
              
              let mergedTxns = Array.from(txnMap.values()).sort((a, b) => new Date(b.date) - new Date(a.date));
              
              // PRUNING: Keep only the latest 500 transactions per account to avoid localStorage quota issues
              if (mergedTxns.length > 500) {
                  console.log(`[BankingContext] Pruning account ${newAcc.accountNumber} from ${mergedTxns.length} to 500 txns`);
                  mergedTxns = mergedTxns.slice(0, 500);
              }

              accountMap.set(newAcc.accountNumber, { ...existingAcc, ...newAcc, txns: mergedTxns });
          } else {
              // PRUNING: Also limit new accounts
              let txns = newAcc.txns || [];
              if (txns.length > 500) {
                  txns = txns.sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 500);
              }
              accountMap.set(newAcc.accountNumber, { ...newAcc, txns });
          }
      });

      // Crucial: Overwrite other fields (like custom categories, overrides, etc.) with newData 
      // if they exist there, but merge the accounts.
      return { 
          ...prevData, 
          ...newData, 
          accounts: Array.from(accountMap.values()),
          categories: newData.categories || prevData.categories,
          overrides: newData.overrides || prevData.overrides
      };
  };

  const handlePaginationMerge = (newData) => {
      let totalNewTxns = 0;
      setData(prevData => {
          if (!prevData || !prevData.accounts) return newData;
          const newAccounts = newData.accounts || [];
          const prevAccounts = prevData.accounts || [];
          
          const mergedAccounts = prevAccounts.map(prevAcc => {
              const newAcc = newAccounts.find(na => na.accountNumber === prevAcc.accountNumber);
              if (newAcc && newAcc.txns && newAcc.txns.length > 0) {
                  const getTxnKey = (t) => t.identifier || `${t.date}_${t.chargedAmount}_${t.description}`;
                  const existingIdentifiers = new Set(prevAcc.txns.map(getTxnKey));
                  
                  const newTxns = newAcc.txns.filter(t => !existingIdentifiers.has(getTxnKey(t)));
                  totalNewTxns += newTxns.length;
                  
                  let mergedTxns = [...prevAcc.txns, ...newTxns].sort((a, b) => new Date(b.date) - new Date(a.date));
                  
                  // PRUNING: Keep only latest 500
                  if (mergedTxns.length > 500) {
                      mergedTxns = mergedTxns.slice(0, 500);
                  }
                  
                  return { ...prevAcc, txns: mergedTxns };
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

  // Computed: Unified Transactions from all accounts
  const allTransactions = React.useMemo(() => {
    if (!accounts || accounts.length === 0) return [];
    
    const all = [];
    const seenTxns = new Set();
    
    accounts.forEach(acc => {
      const txns = acc.txns || [];
      txns.forEach(txn => {
        // Create a fuzzy unique key for de-duplication: 
        // same amount, same date (day only), and similar description
        const dateStr = new Date(txn.date).toISOString().split('T')[0];
        const dedupeKey = `${txn.originalAmount}|${dateStr}|${txn.description.trim()}`;
        
        if (!seenTxns.has(dedupeKey)) {
          all.push({
            ...txn,
            accountNumber: acc.accountNumber,
            accountName: acc.accountName || acc.accountNumber.slice(-4),
            balanceCurrency: acc.balanceCurrency
          });
          seenTxns.add(dedupeKey);
        }
      });
    });
    
    return all.sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [accounts]);

  // Computed: Monthly Data from all transactions
  const monthlyData = React.useMemo(() => {
    if (allTransactions.length === 0) return [];
    
    const months = new Map();
    allTransactions.forEach(txn => {
      const date = new Date(txn.date);
      const monthKey = `${date.getFullYear()}-${date.getMonth()}`;
      if (!months.has(monthKey)) {
        months.set(monthKey, {
          id: monthKey,
          year: date.getFullYear(),
          txns: [],
          fullDate: date
        });
      }
      months.get(monthKey).txns.push(txn);
    });
    
    return Array.from(months.values()).sort((a, b) => b.fullDate - a.fullDate);
  }, [allTransactions]);

  // Auto-select first month if none selected
  useEffect(() => {
    if (monthlyData.length > 0 && !selectedMonthId) {
      setSelectedMonthId(monthlyData[0].id);
    }
  }, [monthlyData, selectedMonthId]);

  // Actions
  const login = () => {
     setShowLoginModal(true);
  };

  const pendingCredentials = useRef(null);

  const performLogin = async (companyId, credentials) => {
      updateLoading(true);
      setErrorMessage(null);
      setStatusMessage("Requesting secure channel...");
      
      // Store creds temporarily in ref (memory only)
      pendingCredentials.current = { companyId, credentials };

      await sendMessage({
          action: 'REQUEST_AUTH_URL'
      });
  };

  const logout = () => {
    setTokens([]);
    setData(null); 
    setConversationId(uuidv4()); // Reset conversation on logout
  };

  const refreshData = async () => {
    if (loading || tokens.length === 0) return;
    updateLoading(true);
    setStatusMessage("Requesting sync...");
    
    // For each token, send a fetch request
    // We do them in sequence or parallel? Agent might struggle with too many parallel sessions if they use same conversation ID.
    // Actually, one FETCH per token is fine.
    for (const token of tokens) {
        await sendMessage({
            action: 'FETCH',
            token,
            sender_id: userId,
            startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
        });
    }
  };
  
  const loadMore = async () => {
      if (loadingMore || loading || !data || tokens.length === 0) return;
      
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
      
      updateLoading(true, true);
      showToast(`Fetching ${targetStartDate.toLocaleString('default', { month: 'long' })} history...`, "info");
      
      for (const token of tokens) {
          await sendMessage({
              action: 'FETCH',
              token,
              sender_id: userId,
              startDate: targetStartDate.toISOString(),
              endDate: targetEndDate.toISOString()
          });
      }
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
  };

  const updateTransaction = async (description, category, memo) => {
      // Optimistic update
      setData(prev => {
          if (!prev || !prev.accounts) return prev;
          const newAccounts = prev.accounts.map(acc => ({
              ...acc,
              txns: acc.txns.map(t => t.description === description ? { ...t, category, memo } : t)
          }));
          return { ...prev, accounts: newAccounts };
      });

      await sendMessage({
          action: 'UPDATE_TRANSACTION',
          description,
          category,
          memo
      });
      showToast("Transaction updated", "success");
  };

  const editCategories = async (newCategories) => {
      // Optimistic update
      setData(prev => ({ ...prev, categories: newCategories }));

      await sendMessage({
          action: 'EDIT_CATEGORIES',
          categories: newCategories
      });
      showToast("Categories updated", "success");
  };

  const value = {
      conversationId,
      userId,
      tokens,
      token: tokens[0] || "", // For backward compatibility if needed in UI
      data,
      accounts,
      categories: data?.categories || [],
      overrides: data?.overrides || {},
      loading,
      loadingMore,
      statusMessage,
      selectedAccountIndex,
      setSelectedAccountIndex,
      selectedMonthId,
      setSelectedMonthId,
      monthlyData,
      allTransactions,
      otpNeeded,
      otpValue,
      setOtpValue,
      login,
      logout,
      refreshData,
      loadMore,
      submitOtp,
      updateTransaction,
      editCategories,
      showLoginModal,
      setShowLoginModal,
      performLogin,
      companies,
      errorMessage,
      lastSyncTime
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
