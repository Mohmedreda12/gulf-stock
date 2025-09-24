// استدعاء مكتبات Firebase
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

// إعدادات مشروعك من Firebase Console
const firebaseConfig = {
  apiKey: "AIzaSyBLPI2ZyVXWbUOeuCO9xkeOFzxypYyiQlg",
  authDomain: "gudp-163d6.firebaseapp.com",
  projectId: "gudp-163d6",
  storageBucket: "gudp-163d6.firebasestorage.app",
  messagingSenderId: "61268698730",
  appId: "1:61268698730:web:27dc1f06fa1cf36f908c13",
  measurementId: "G-GJ7JNB4VBJ"
};

// تهيئة Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

