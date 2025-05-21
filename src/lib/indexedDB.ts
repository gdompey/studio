// src/lib/indexedDB.ts
import type { DBSchema, IDBPDatabase, StoreNames } from 'idb';
import { openDB } from 'idb';
import type { InspectionData, InspectionPhoto } from '@/types';

const DB_NAME = 'iasl-ec-manager-db';
const DB_VERSION = 1;
const INSPECTIONS_STORE_NAME = 'inspections';

// Define the local version of InspectionData for IndexedDB
export interface LocalInspectionData extends Omit<InspectionData, 'id' | 'photos'> {
  localId: string; // Client-generated ID for offline items
  id?: string; // Firestore ID, populated after sync
  photos: Array<InspectionPhoto>; // Will store dataUris for offline photos
  needsSync: boolean;
  timestamp: string; // Ensure timestamp is always string
}

interface IASLDB extends DBSchema {
  [INSPECTIONS_STORE_NAME]: {
    key: string; // localId
    value: LocalInspectionData;
    indexes: { 'needsSync': boolean, 'timestamp': string };
  };
}

let dbPromise: Promise<IDBPDatabase<IASLDB>> | null = null;

const getDb = (): Promise<IDBPDatabase<IASLDB>> => {
  if (!dbPromise) {
    dbPromise = openDB<IASLDB>(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion, newVersion, transaction) {
        console.log(`Upgrading DB from version ${oldVersion} to ${newVersion}`);
        if (!db.objectStoreNames.contains(INSPECTIONS_STORE_NAME)) {
          const store = db.createObjectStore(INSPECTIONS_STORE_NAME, { keyPath: 'localId' });
          store.createIndex('needsSync', 'needsSync');
          store.createIndex('timestamp', 'timestamp');
        }
      },
    });
  }
  return dbPromise;
};


export async function saveInspectionOffline(inspectionData: Omit<LocalInspectionData, 'needsSync'>): Promise<string> {
  const db = await getDb();
  const localId = inspectionData.localId || `offline_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  const dataToSave: LocalInspectionData = {
    ...inspectionData,
    localId,
    needsSync: true,
    timestamp: inspectionData.timestamp || new Date().toISOString(), // Ensure timestamp
  };
  await db.put(INSPECTIONS_STORE_NAME, dataToSave);
  return localId;
}

export async function getOfflineInspections(): Promise<LocalInspectionData[]> {
  const db = await getDb();
  return db.getAllFromIndex(INSPECTIONS_STORE_NAME, 'timestamp'); // Get all, sort by timestamp
}

export async function getInspectionByIdOffline(localId: string): Promise<LocalInspectionData | undefined> {
  const db = await getDb();
  return db.get(INSPECTIONS_STORE_NAME, localId);
}


export async function getInspectionsToSync(): Promise<LocalInspectionData[]> {
  const db = await getDb();
  return db.getAllFromIndex(INSPECTIONS_STORE_NAME, 'needsSync', IDBKeyRange.only(true as any));
}

export async function markInspectionSynced(localId: string, firestoreId: string): Promise<void> {
  const db = await getDb();
  const inspection = await db.get(INSPECTIONS_STORE_NAME, localId);
  if (inspection) {
    inspection.needsSync = false;
    inspection.id = firestoreId; // Store the Firestore ID
    // Optionally, clear large data like photo dataUris if they are no longer needed locally
    // inspection.photos.forEach(p => delete p.dataUri);
    await db.put(INSPECTIONS_STORE_NAME, inspection);
  }
}

export async function updateSyncedInspectionPhotos(localId: string, photosWithUrls: Array<{ name: string; url: string }>): Promise<void> {
    const db = await getDb();
    const inspection = await db.get(INSPECTIONS_STORE_NAME, localId);
    if (inspection) {
        inspection.photos = photosWithUrls.map(p => ({...p, dataUri: undefined })); // Clear dataUri after upload
        await db.put(INSPECTIONS_STORE_NAME, inspection);
    }
}


export async function deleteInspectionOffline(localId: string): Promise<void> {
  const db = await getDb();
  await db.delete(INSPECTIONS_STORE_NAME, localId);
}
