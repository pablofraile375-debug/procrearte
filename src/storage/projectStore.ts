import type { DocumentState } from '../types/app';

const DB = 'procrearte-studio';
const STORE = 'documents';

type StoredDocument = DocumentState & { savedAt: number; version: string };

const open = () => new Promise<IDBDatabase>((resolve, reject) => {
  const request = indexedDB.open(DB, 1);
  request.onupgradeneeded = () => {
    const db = request.result;
    if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'id' });
  };
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error);
});

export async function saveDocument(document: DocumentState) {
  const db = await open();
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(STORE, 'readwrite');
    transaction.objectStore(STORE).put({ ...document, savedAt: Date.now(), version: crypto.randomUUID() });
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
  db.close();
}

export async function loadDocument(id: string) {
  const db = await open();
  const result = await new Promise<StoredDocument | undefined>((resolve, reject) => {
    const transaction = db.transaction(STORE, 'readonly');
    const request = transaction.objectStore(STORE).get(id);
    request.onsuccess = () => resolve(request.result as StoredDocument | undefined);
    request.onerror = () => reject(request.error);
  });
  db.close();
  return result;
}
