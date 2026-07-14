import { initializeApp } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-app.js";
// قمنا هنا باستدعاء جميع أدوات قاعدة البيانات (Firestore) اللازمة للعمل
import { 
    getFirestore, 
    collection, 
    getDocs, 
    getDoc, 
    addDoc, 
    setDoc, 
    updateDoc, 
    deleteDoc, 
    doc, 
    onSnapshot, 
    serverTimestamp 
} from "https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js";

// إعدادات مشروعك كما هي لم تتغير
const firebaseConfig = {
    apiKey: "AIzaSyDKnlA4fe5DsFSB7Yn7yT8emk8uy2GFmMY",
    authDomain: "jhjh-175e2.firebaseapp.com",
    projectId: "jhjh-175e2",
    storageBucket: "jhjh-175e2.firebasestorage.app",
    messagingSenderId: "143369980570",
    appId: "1:143369980570:web:7d1ffc5eff6ff3a519ad23"
};

// تهيئة التطبيق
const app = initializeApp(firebaseConfig);

// الاتصال بقاعدة البيانات
const db = getFirestore(app);

// هذه الخطوة مهمة جداً: نجعل أدوات قاعدة البيانات متاحة لملف script.js لكي يستخدمها
window.db = db;
window.firestore = {
    collection,
    getDocs,
    getDoc,
    addDoc,
    setDoc,
    updateDoc,
    deleteDoc,
    doc,
    onSnapshot,
    serverTimestamp
};

// إطلاق إشارة لباقي ملفات المشروع أن الاتصال بقاعدة البيانات جاهز ويمكنهم البدء
const event = new Event('firebaseReady');
window.dispatchEvent(event);
