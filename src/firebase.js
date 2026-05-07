import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore, enableIndexedDbPersistence } from "firebase/firestore";

const firebaseConfig = {
    apiKey: "AIzaSyBwRBXvERuCA7RoDK02Z_EXgBqf56TjAWE",
    authDomain: "point-do-hugao.firebaseapp.com",
    projectId: "point-do-hugao",
    storageBucket: "point-do-hugao.appspot.com",
    messagingSenderId: "336392692353",
    appId: "1:336392692353:web:69457d44481e85b6502380"
};

const app = initializeApp(firebaseConfig);

// Initialize Services
export const auth = getAuth(app);
export const db = getFirestore(app);

// Habilitar persistência offline (Essencial para performance no celular)
enableIndexedDbPersistence(db).catch((err) => {
    if (err.code === 'failed-precondition') {
        console.warn('Persistência falhou: múltiplas abas');
    } else if (err.code === 'unimplemented') {
        console.warn('Persistência não suportada');
    }
});
