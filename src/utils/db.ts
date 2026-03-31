import { openDB } from 'idb';

const DB_NAME = 'secure_chat_db';
const STORE_NAME = 'keys';

export const initDB = async () => {
  return openDB(DB_NAME, 1, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    },
  });
};

export const savePrivateKey = async (userId: string, privateKeyPem: string) => {
  const db = await initDB();
  await db.put(STORE_NAME, privateKeyPem, `private_key_${userId}`);
};

export const getPrivateKey = async (userId: string): Promise<string | undefined> => {
  const db = await initDB();
  return db.get(STORE_NAME, `private_key_${userId}`);
};

export const clearPrivateKey = async (userId: string) => {
  const db = await initDB();
  await db.delete(STORE_NAME, `private_key_${userId}`);
};
