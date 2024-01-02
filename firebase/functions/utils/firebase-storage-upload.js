require("dotenv").config();
const fs = require("fs");
const { initializeApp } = require("firebase/app");
const {
  getStorage,
  ref,
  uploadBytes,
  getDownloadURL,
} = require("firebase/storage");

const firebaseConfig = {
  apiKey: process.env.API_KEY,
  authDomain: process.env.AUTH_DOMAIN,
  projectId: process.env.PROJECT_ID,
  databaseURL: process.env.FIRESTORE_DB_URL,
  storageBucket: process.env.STORAGE_BUCKET,
  messagingSenderId: process.env.MESSAGING_SENDER_ID,
  appId: process.env.APP_ID,
  measurementId: process.env.MEASUREMENT_ID,
};

initializeApp(firebaseConfig);
const storage = getStorage();

async function uploadImageToFirebaseStorage(path, newFilename, mimetype) {
  const storageRef = ref(storage, newFilename);
  const buffer = fs.readFileSync(path);
  const metadata = {
    contentType: mimetype,
  };
  const snapshot = await uploadBytes(storageRef, buffer, metadata);
  const downloadURL = await getDownloadURL(snapshot.ref);
  return downloadURL;
}

module.exports = { uploadImageToFirebaseStorage };
