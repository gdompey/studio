
// src/lib/indexedDB.ts
import type { DBSchema, IDBPDatabase } from 'idb';
import { openDB } from 'idb';
import type { InspectionData, InspectionPhoto } from '@/types';

const DB_NAME = 'iasl-ec-manager-db';
const DB_VERSION = 2; // Version remains 2
const INSPECTIONS_STORE_NAME = 'inspections';

// Define the local version of InspectionData for IndexedDB
export interface LocalInspectionData extends Omit<InspectionData, 'id' | 'photos' | 'needsSync'> {
  localId: string; // Client-generated ID for offline items
  id?: string; // Firestore ID, populated after sync
  photos: Array<InspectionPhoto>; // Will store dataUris for offline photos
  needsSync: number; // 0 for false, 1 for true
  timestamp: string; // Ensure timestamp is always string
  workshopLocation?: string; 
  vehicleOdometer?: string; // Added Vehicle Odometer

  // New fields for vehicle release (match InspectionData)
  isReleased?: boolean;
  releasedAt?: string | null;
  releasedByUserId?: string;
  releasedByUserName?: string;
}

interface IASLDB extends DBSchema {
  [INSPECTIONS_STORE_NAME]: {
    key: string; // localId
    value: LocalInspectionData;
    indexes: { 'needsSync': number; 'timestamp': string };
  };
}

let dbPromise: Promise<IDBPDatabase<IASLDB>> | null = null;

const getDb = (): Promise<IDBPDatabase<IASLDB>> => {
  if (typeof window === 'undefined') {
    // This code is running on the server, IndexedDB is not available.
    // console.error("Attempted to access IndexedDB on the server."); // Optional: for server logs
    return Promise.reject(new Error("IndexedDB is not available on the server."));
  }
  if (!dbPromise) {
    dbPromise = openDB<IASLDB>(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion, newVersion, transaction) {
        console.log(`Upgrading DB from version ${oldVersion} to ${newVersion}`);
        
        let store;
        if (!db.objectStoreNames.contains(INSPECTIONS_STORE_NAME)) {
          store = db.createObjectStore(INSPECTIONS_STORE_NAME, { keyPath: 'localId' });
        } else {
          store = transaction.objectStore(INSPECTIONS_STORE_NAME);
        }

        // Ensure indexes are correctly set up, especially if migrating
        if (oldVersion < 2) { 
            // If upgrading from a version where needsSync might have been different
            // (e.g., stored booleans, or index was misconfigured)
            // it's safer to delete and recreate the index.
            if (store.indexNames.contains('needsSync')) {
                store.deleteIndex('needsSync');
            }
            store.createIndex('needsSync', 'needsSync'); // Will store numbers
        } else {
            // For new creations or upgrades from v2+ where needsSync should already be correct
            if (!store.indexNames.contains('needsSync')) {
              store.createIndex('needsSync', 'needsSync');
            }
        }
        
        if (!store.indexNames.contains('timestamp')) {
          store.createIndex('timestamp', 'timestamp');
        }
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
    needsSync: 1, 
    timestamp: inspectionData.timestamp || new Date().toISOString(),
  };
  await db.put(INSPECTIONS_STORE_NAME, dataToSave);
  return localId;
}

export async function updateInspectionOffline(localId: string, updates: Partial<Omit<LocalInspectionData, 'localId'>>): Promise<void> {
  const db = await getDb();
  const transaction = db.transaction(INSPECTIONS_STORE_NAME, 'readwrite');
  const store = transaction.objectStore(INSPECTIONS_STORE_NAME);
  const inspection = await store.get(localId);

  if (inspection) {
    const updatedInspection: LocalInspectionData = {
      ...inspection,
      ...updates,
      needsSync: 'needsSync' in updates ? (updates.needsSync as number) : 1,
    };
    await store.put(updatedInspection);
    await transaction.done;
  } else {
    console.warn(`Inspection with localId ${localId} not found for offline update.`);
  }
}


export async function getOfflineInspections(): Promise<LocalInspectionData[]> {
  const db = await getDb();
  // Sort by timestamp descending to get latest first
  const allInspections = await db.getAllFromIndex(INSPECTIONS_STORE_NAME, 'timestamp');
  return allInspections.reverse(); 
}

export async function getInspectionByIdOffline(localId: string): Promise<LocalInspectionData | undefined> {
  const db = await getDb();
  return db.get(INSPECTIONS_STORE_NAME, localId);
}


export async function getInspectionsToSync(): Promise<LocalInspectionData[]> {
  const db = await getDb();
  return db.getAllFromIndex(INSPECTIONS_STORE_NAME, 'needsSync', IDBKeyRange.only(1));
}

export async function markInspectionSynced(localId: string, firestoreId: string): Promise<void> {
  const db = await getDb();
  const inspection = await db.get(INSPECTIONS_STORE_NAME, localId);
  if (inspection) {
    inspection.needsSync = 0; 
    inspection.id = firestoreId; 
    await db.put(INSPECTIONS_STORE_NAME, inspection);
  }
}

export async function updateSyncedInspectionPhotos(localId: string, photosWithUrls: Array<{ name: string; url: string }>): Promise<void> {
    const db = await getDb();
    const inspection = await db.get(INSPECTIONS_STORE_NAME, localId);
    if (inspection) {
        inspection.photos = photosWithUrls.map(p => ({ name: p.name, url: p.url, dataUri: undefined }));
        await db.put(INSPECTIONS_STORE_NAME, inspection);
    }
}


export async function deleteInspectionOffline(localId: string): Promise<void> {
  const db = await getDb();
  await db.delete(INSPECTIONS_STORE_NAME, localId);
}
