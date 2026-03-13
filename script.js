// script.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.10.0/firebase-app.js";
import { getFirestore, doc, setDoc, getDoc, collection, getDocs } from "https://www.gstatic.com/firebasejs/12.10.0/firebase-firestore.js";
import { getStorage, ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/12.10.0/firebase-storage.js";
import { jsPDF } from "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js";
import JSZip from "https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js";

// Firebase Setup
const firebaseConfig = {
  apiKey: "AIzaSyDHJQaoWtPUmaFq4ua-o6y6kPaXbpMNddE",
  authDomain: "bookbuilder-43fe2.firebaseapp.com",
  projectId: "bookbuilder-43fe2",
  storageBucket: "bookbuilder-43fe2.appspot.com",
  messagingSenderId: "165314040742",
  appId: "1:165314040742:web:460484fd3019f8a432b567"
};
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const storage = getStorage(app);

// Buchdaten
let books = [];
let currentBook = null;
let currentChapter = null;
let previewIndex = 0;

// === Bücherverwaltung ===

// Neues Buch
export async function newBook() {
  const title = prompt("Buchtitel eingeben:");
  if (!title) return;
  const book = { title, chapters: [], audioURL: null };
  books.push(book);
  currentBook = book;
  renderBooks();
  document.getElementById('chapters').innerHTML = "<h4>Kapitel</h4>";
  document.getElementById('editor').innerText = "";
  await saveBookToFirestore(book);
}

// Bücherliste rendern
function renderBooks() {
  const list = document.getElementById('booksList');
  list.innerHTML = "";
  books.forEach((book,i) => {
    const btn = document.createElement('button');
    btn.innerText = book.title;
    btn.onclick = () => selectBook(i);
    list.appendChild(btn);
  });
}

// Buch auswählen
export async function selectBook(index) {
  currentBook = books[index];
  await loadBookFromFirestore(currentBook.title);
  currentChapter = currentBook.chapters[0] || null;
  document.getElementById('editor').innerText = currentChapter ? currentChapter.text : "";
  renderChapters();
}

// Kapitel hinzufügen
export async function addChapter() {
  if (!currentBook) return alert("Erst ein Buch erstellen!");
  const name = prompt("Kapitelname:");
  if (!name) return;
  const chapter = { name, text: "" };
  currentBook.chapters.push(chapter);
  currentChapter = chapter;
  renderChapters();
  document.getElementById('editor').innerText = "";
  await saveBookToFirestore(currentBook);
}

// Kapitel rendern
function renderChapters() {
  const list = document.getElementById('chapters');
  list.innerHTML = "<h4>Kapitel</h4>";
  currentBook.chapters.forEach((ch,i)=>{
    const btn = document.createElement('button');
    btn.innerText = ch.name;
    btn.onclick = () => selectChapter(i);
    list.appendChild(btn);
  });
}

// Kapitel auswählen
export function selectChapter(index) {
  currentChapter = currentBook.chapters[index];
  document.getElementById('editor').innerText = currentChapter.text;
}

// Text speichern (live update)
document.getElementById('editor').addEventListener('input', async () => {
  if (currentChapter) {
    currentChapter.text = document.getElementById('editor').innerText;
    if (currentBook) await saveBookToFirestore(currentBook);
  }
});

// === Vorschau Vollbildmodus ===

export function openPreview() {
  if (!currentBook || currentBook.chapters.length===0) return alert("Buch ohne Kapitel!");
  previewIndex = 0;
  document.getElementById('previewOverlay').style.display="block";
  showPreviewPage();
}

export function closePreview() {
  document.getElementById('previewOverlay').style.display="none";
}

function showPreviewPage() {
  if(!currentBook) return;
  const pageDiv = document.getElementById('previewPage');
  if(previewIndex<0) previewIndex=0;
  if(previewIndex>=currentBook.chapters.length) previewIndex=currentBook.chapters.length-1;
  const ch = currentBook.chapters[previewIndex];
  pageDiv.innerHTML = `<h2>${ch.name}</h2><p>${ch.text.replace(/\n/g,'<br>')}</p>`;
}

export function prevPage(){ previewIndex--; showPreviewPage(); }
export function nextPage(){ previewIndex++; showPreviewPage(); }

// === PDF Export ===
export async function exportPDF() {
  if (!currentBook) return alert("Erst ein Buch auswählen!");
  const doc = new jsPDF();
  let y = 10;
  currentBook.chapters.forEach(ch => {
    doc.setFontSize(16);
    doc.text(ch.name,10,y); y+=10;
    doc.setFontSize(12);
    const lines = doc.splitTextToSize(ch.text,180);
    doc.text(lines,10,y);
    y += lines.length*7 +10;
    if(y>270){doc.addPage();y=10;}
  });
  doc.save(`${currentBook.title}.pdf`);
}

// === Audio hinzufügen ===
export async function addAudio(event) {
  if (!currentBook) return alert("Erst ein Buch auswählen!");
  const file = event.target.files[0];
  if(file && file.type==="audio/mp3"){
    const storageRef = ref(storage, `audio/${currentBook.title}/${file.name}`);
    await uploadBytes(storageRef,file);
    const url = await getDownloadURL(storageRef);
    currentBook.audioURL = url;
    alert("Audio erfolgreich hochgeladen!");
    await saveBookToFirestore(currentBook);
  }
}

// === Firestore speichern / laden ===
async function saveBookToFirestore(book){
  try{ await setDoc(doc(db,"books",book.title),book); }
  catch(e){ console.error("Fehler beim Speichern:",e); }
}

async function loadBookFromFirestore(title){
  try{
    const docRef = doc(db,"books",title);
    const docSnap = await getDoc(docRef);
    if(docSnap.exists()){ currentBook = docSnap.data(); currentChapter = currentBook.chapters[0] || null; renderChapters();}
  } catch(e){ console.error("Fehler beim Laden:",e); }
}

// === .lbook Export ===
export async function exportLBook() {
  if(!currentBook) return alert("Erst ein Buch auswählen!");
  const zip = new JSZip();
  zip.file("book.json",JSON.stringify(currentBook));
  if(currentBook.audioURL){
    const response = await fetch(currentBook.audioURL);
    const audioBlob = await response.blob();
    zip.file("audio.mp3",audioBlob);
  }
  const content = await zip.generateAsync({type:"blob"});
  const link = document.createElement("a");
  link.href = URL.createObjectURL(content);
  link.download = `${currentBook.title}.lbook`;
  link.click();
}

// === Alle Bücher beim Laden abrufen ===
window.addEventListener('load', async () => {
  const querySnapshot = await getDocs(collection(db,"books"));
  books=[];
  querySnapshot.forEach(doc => books.push(doc.data()));
  renderBooks();
});
