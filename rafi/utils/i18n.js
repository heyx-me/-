import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

const resources = {
  en: {
    translation: {
      "spendingTrend": "Spending Trend",
      "max": "Max",
      "recentActivity": "Recent Activity",
      "noTransactions": "No transactions found",
      "noTransactionsDesc": "We couldn't find any transactions for this period. Try loading older data.",
      "checking": "Checking...",
      "checkOlderRecords": "Check older records",
      "loadingMore": "Loading more...",
      "endOfList": "End of list",
      "heroTitle": "Your finances,",
      "heroHighlight": "simplified",
      "heroSubtitle": "Connect your bank securely to track transactions, monitor spending, and gain insights without the clutter.",
      "connectBank": "Connect via BankID",
      "security": "Bank-grade Security",
      "realTimeSync": "Real-time Sync",
      "readOnlyAccess": "Read-only Access",
      "securityVerification": "Security Verification",
      "verificationSent": "A verification code has been sent to your device.",
      "doNotShare": "Please do not share this code with anyone.",
      "verifyIdentity": "Verify Identity",
      "refreshData": "Refresh Data",
      "lightMode": "Light Mode",
      "darkMode": "Dark Mode",
      "signOut": "Sign Out",
      "today": "Today",
      "yesterday": "Yesterday",
      "thisWeek": "This Week",
      "lastWeek": "Last Week",
      "weekOf": "Week of {{date}}",
      "spendingByCategory": "Spending by Category",
      "categories": {
        "Food & Dining": "Food & Dining",
        "Groceries": "Groceries",
        "Transport": "Transport",
        "Utilities": "Utilities",
        "Shopping": "Shopping",
        "Entertainment": "Entertainment",
        "Health": "Health",
        "Transfer": "Transfer",
        "Income": "Income",
        "Other": "Other",
        "Uncategorized": "Uncategorized"
      }
    }
  },
  he: {
    translation: {
      "spendingTrend": "מגמת הוצאות",
      "max": "מקסימום",
      "recentActivity": "פעילות אחרונה",
      "noTransactions": "לא נמצאו עסקאות",
      "noTransactionsDesc": "לא הצלחנו למצוא עסקאות לתקופה זו. נסה לטעון נתונים ישנים יותר.",
      "checking": "בודק...",
      "checkOlderRecords": "בדוק רשומות ישנות יותר",
      "loadingMore": "טוען עוד...",
      "endOfList": "סוף הרשימה",
      "heroTitle": "הכספים שלך,",
      "heroHighlight": "בפשטות",
      "heroSubtitle": "חבר את הבנק שלך בצורה מאובטחת כדי לעקוב אחר עסקאות, לנטר הוצאות ולקבל תובנות ללא בלאגן.",
      "connectBank": "התחבר באמצעות BankID",
      "security": "אבטחה ברמת בנק",
      "realTimeSync": "סנכרון בזמן אמת",
      "readOnlyAccess": "גישה לקריאה בלבד",
      "securityVerification": "אימות אבטחה",
      "verificationSent": "קוד אימות נשלח למכשיר שלך.",
      "doNotShare": "אנא אל תשתף קוד זה עם אף אחד.",
      "verifyIdentity": "אמת זהות",
      "refreshData": "רענן נתונים",
      "lightMode": "מצב בהיר",
      "darkMode": "מצב כהה",
      "signOut": "התנתק",
      "today": "היום",
      "yesterday": "אתמול",
      "thisWeek": "השבוע",
      "lastWeek": "שבוע שעבר",
      "weekOf": "שבוע של {{date}}",
      "spendingByCategory": "הוצאות לפי קטגוריה",
      "categories": {
        "Food & Dining": "אוכל ומסעדות",
        "Groceries": "קניות וסופר",
        "Transport": "תחבורה ורכב",
        "Utilities": "חשבונות ומסים",
        "Shopping": "קניות",
        "Entertainment": "בילויים ופנאי",
        "Health": "בריאות ופארם",
        "Transfer": "העברות",
        "Income": "הכנסות",
        "Other": "אחר",
        "Uncategorized": "ללא קטגוריה"
      }
    }
  }
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'en',
    debug: true,
    react: {
      useSuspense: false
    },
    interpolation: {
      escapeValue: false,
    }
  });

export default i18n;
