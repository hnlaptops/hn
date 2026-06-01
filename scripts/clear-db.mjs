import { initializeApp } from "firebase/app";
import {
  getFirestore,
  collection,
  getDocs,
  deleteDoc,
  writeBatch,
} from "firebase/firestore";

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
const db = getFirestore(app);

const collections = ["purchases", "sales", "ledger"];

async function clearCollection(name) {
  const snapshot = await getDocs(collection(db, name));
  const docs = snapshot.docs;

  if (docs.length === 0) {
    console.log(`  "${name}" is already empty.`);
    return;
  }

  console.log(`  "${name}": ${docs.length} document(s) found. Deleting...`);

  let batch = writeBatch(db);
  let opCount = 0;
  for (let i = 0; i < docs.length; i++) {
    batch.delete(docs[i].ref);
    opCount++;
    if (opCount === 500) {
      await batch.commit();
      batch = writeBatch(db);
      opCount = 0;
    }
  }
  if (opCount > 0) {
    await batch.commit();
  }

  console.log(`  "${name}": Deleted ${docs.length} document(s).`);
}

async function main() {
  console.log("Clearing Firestore database (hn-web-ab5a0)...\n");
  for (const name of collections) {
    await clearCollection(name);
  }
  console.log("\nDone. All collections cleared.");
}

main().catch(console.error);
