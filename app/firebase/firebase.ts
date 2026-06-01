import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyD8APyQbpvSDp9l7vVSA00_6LwYbyhf6t4",
  authDomain: "hn-web-ab5a0.firebaseapp.com",
  projectId: "hn-web-ab5a0",
  storageBucket: "hn-web-ab5a0.firebasestorage.app",
  messagingSenderId: "353793102050",
  appId: "1:353793102050:web:4d22f7ed473759f1594ebb",
  measurementId: "G-TMW8GWG5HW",
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
