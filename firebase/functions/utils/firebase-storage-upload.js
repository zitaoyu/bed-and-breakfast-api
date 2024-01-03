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
  storageBucket: process.env.STORAGE_BUCKET,
  messagingSenderId: process.env.MESSAGING_SENDER_ID,
  appId: process.env.APP_ID,
};

const BUCKET_IMAGE_FOLDLER = process.env.BUCKET_IMAGE_FOLDLER;

initializeApp(firebaseConfig);
const storage = getStorage();

async function uploadImageToFirebaseStorage(path, newFilename, mimetype) {
  const storageRef = ref(storage, BUCKET_IMAGE_FOLDLER + newFilename);
  const buffer = fs.readFileSync(path);
  const metadata = {
    contentType: mimetype,
  };
  const snapshot = await uploadBytes(storageRef, buffer, metadata);
  const downloadURL = await getDownloadURL(snapshot.ref);
  return downloadURL;
}

module.exports = { uploadImageToFirebaseStorage };
