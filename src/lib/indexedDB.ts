// src/lib/indexedDB.ts
import type { DBSchema, IDBPDatabase } from 'idb';
import { openDB } from 'idb';
import type { InspectionData, InspectionPhoto } from '@/types';

const DB_NAME = 'iasl-ec-manager-db';
const DB_VERSION = 2; // Incremented version
const INSPECTIONS_STORE_NAME = 'inspections';

// Define the local version of InspectionData for IndexedDB
export interface LocalInspectionData extends Omit<InspectionData, 'id' | 'photos' | 'needsSync'> {
  localId: string; // Client-generated ID for offline items
  id?: string; // Firestore ID, populated after sync
  photos: Array<InspectionPhoto>; // Will store dataUris for offline photos
  needsSync: number; // 0 for false, 1 for true
  timestamp: string; // Ensure timestamp is always string
}

interface IASLDB extends DBSchema {
  [INSPECTIONS_STORE_NAME]: {
    key: string; // localId
    value: LocalInspectionData;
    indexes: { 'needsSync': number; 'timestamp': string }; // Ensure 'needsSync' is number here
  };
}

let dbPromise: Promise<IDBPDatabase<IASLDB>> | null = null;

const getDb = (): Promise<IDBPDatabase<IASLDB>> => {
  if (!dbPromise) {
    dbPromise = openDB<IASLDB>(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion, newVersion, transaction) {
        console.log(`Upgrading DB from version ${oldVersion} to ${newVersion}`);
        
        // Handle initial creation or upgrade to version 2
        if (oldVersion < 2) {
          let store;
          if (db.objectStoreNames.contains(INSPECTIONS_STORE_NAME)) {
            store = transaction.objectStore(INSPECTIONS_STORE_NAME);
            // If upgrading from a version where 'needsSync' might have been boolean,
            // it's safest to delete and recreate the index.
            if (store.indexNames.contains('needsSync')) {
              // Potentially delete and recreate if type change is certain and problematic.
              // For now, we ensure it's created if it doesn't exist or if recreating.
              // If the index existed with a different type, `createIndex` might error
              // or behave unexpectedly without explicit deletion.
              // A simple approach if issues persist after version bump:
              // store.deleteIndex('needsSync');
              // store.createIndex('needsSync', 'needsSync');
            }
          } else {
            store = db.createObjectStore(INSPECTIONS_STORE_NAME, { keyPath: 'localId' });
          }

          // Ensure 'needsSync' index is created (or re-created) to handle numbers
          if (!store.indexNames.contains('needsSync')) {
            store.createIndex('needsSync', 'needsSync');
          }
          // Ensure 'timestamp' index exists
          if (!store.indexNames.contains('timestamp')) {
            store.createIndex('timestamp', 'timestamp');
          }
        }
        // Add further upgrade steps for future versions here:
        // if (oldVersion < 3) { /* changes for version 3 */ }
      },
    });
  }
  return dbPromise;
};


export async function saveInspectionOffline(inspectionData: Omit<LocalInspectionData, 'needsSync' | 'localId'> & {localId?: string}): Promise<string> {
  const db = await getDb();
  const localId = inspectionData.localId || `offline_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  const dataToSave: LocalInspectionData = {
    ...inspectionData,
    localId,
    needsSync: 1, // Store 1 for true
    timestamp: inspectionData.timestamp || new Date().toISOString(), // Ensure timestamp
  };
  await db.put(INSPECTIONS_STORE_NAME, dataToSave);
  return localId;
}

export async function getOfflineInspections(): Promise<LocalInspectionData[]> {
  const db = await getDb();
  // Sort by timestamp descending to show newest first
  const allInspections = await db.getAllFromIndex(INSPECTIONS_STORE_NAME, 'timestamp');
  return allInspections.reverse(); 
}

export async function getInspectionByIdOffline(localId: string): Promise<LocalInspectionData | undefined> {
  const db = await getDb();
  return db.get(INSPECTIONS_STORE_NAME, localId);
}


export async function getInspectionsToSync(): Promise<LocalInspectionData[]> {
  const db = await getDb();
  return db.getAllFromIndex(INSPECTIONS_STORE_NAME, 'needsSync', IDBKeyRange.only(1)); // Query for 1 (true)
}

export async function markInspectionSynced(localId: string, firestoreId: string): Promise<void> {
  const db = await getDb();
  const inspection = await db.get(INSPECTIONS_STORE_NAME, localId);
  if (inspection) {
    inspection.needsSync = 0; // Store 0 for false
    inspection.id = firestoreId; // Store the Firestore ID
    await db.put(INSPECTIONS_STORE_NAME, inspection);
  }
}

export async function updateSyncedInspectionPhotos(localId: string, photosWithUrls: Array<{ name: string; url: string }>): Promise<void> {
    const db = await getDb();
    const inspection = await db.get(INSPECTIONS_STORE_NAME, localId);
    if (inspection) {
        // Update photos to only contain Firebase URLs, remove dataUris to save space
        inspection.photos = photosWithUrls.map(p => ({ name: p.name, url: p.url, dataUri: undefined }));
        await db.put(INSPECTIONS_STORE_NAME, inspection);
    }
}


export async function deleteInspectionOffline(localId: string): Promise<void> {
  const db = await getDb();
  await db.delete(INSPECTIONS_STORE_NAME, localId);
}
