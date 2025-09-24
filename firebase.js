// firebase.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

// بيانات المشروع من Firebase Console
const firebaseConfig = {
  apiKey: "AIzaSyBLPI2ZyVXWbUOeuCO9xkeOFzxypYyiQlg",
  authDomain: "gudp-163d6.firebaseapp.com",
  projectId: "gudp-163d6",
  storageBucket: "gudp-163d6.appspot.com",
  messagingSenderId: "61268698730",
  appId: "1:61268698730:web:27dc1f06fa1cf36f908c13",
  measurementId: "G-GJ7JNB4VBJ"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);