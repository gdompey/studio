
// src/lib/indexedDB.ts
import type { DBSchema, IDBPDatabase } from 'idb';
import { openDB } from 'idb';
import type { InspectionData, InspectionPhoto } from '@/types';

const DB_NAME = 'iasl-ec-manager-db';
const DB_VERSION = 2; // Version remains 2 as new fields are optional
const INSPECTIONS_STORE_NAME = 'inspections';

// Define the local version of InspectionData for IndexedDB
export interface LocalInspectionData extends Omit<InspectionData, 'id' | 'photos' | 'needsSync'> {
  localId: string; // Client-generated ID for offline items
  id?: string; // Firestore ID, populated after sync
  photos: Array<InspectionPhoto>; // Will store dataUris for offline photos
  needsSync: number; // 0 for false, 1 for true
  timestamp: string; // Ensure timestamp is always string
  workshopLocation?: string; // Added workshop location

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

        if (!store.indexNames.contains('needsSync')) {
          store.createIndex('needsSync', 'needsSync');
        }
        if (!store.indexNames.contains('timestamp')) {
          store.createIndex('timestamp', 'timestamp');
        }
        // No need to explicitly add workshopLocation index unless querying by it
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
      // Ensure needsSync is 1 if there are offline updates,
      // unless explicitly set to 0 by a sync operation.
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
    // If photos were synced, their dataUris might have been cleared.
    // This function focuses on marking sync status and assigning Firestore ID.
    // Photo URL updates are handled by updateSyncedInspectionPhotos.
    await db.put(INSPECTIONS_STORE_NAME, inspection);
  }
}

export async function updateSyncedInspectionPhotos(localId: string, photosWithUrls: Array<{ name: string; url: string }>): Promise<void> {
    const db = await getDb();
    const inspection = await db.get(INSPECTIONS_STORE_NAME, localId);
    if (inspection) {
        inspection.photos = photosWithUrls.map(p => ({ name: p.name, url: p.url, dataUri: undefined }));
        // Note: if this update happens after markInspectionSynced, needsSync should remain 0.
        // Consider if this should also take needsSync as a parameter or if it's part of the same sync transaction.
        await db.put(INSPECTIONS_STORE_NAME, inspection);
    }
}


export async function deleteInspectionOffline(localId: string): Promise<void> {
  const db = await getDb();
  await db.delete(INSPECTIONS_STORE_NAME, localId);
}

