// src/components/auth/AuthContext.tsx
"use client";

import type { User as FirebaseUserType } from 'firebase/auth';
import { 
  onAuthStateChanged, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut as firebaseSignOut, 
  GoogleAuthProvider, 
  signInWithPopup,
  updateProfile
} from 'firebase/auth';
import { auth, firestore, storage } from '@/lib/firebase/config'; 
import type { User, InspectionData as FirestoreInspectionData } from '@/types';
import type { UserRole } from '@/lib/constants';
import { USER_ROLES } from '@/lib/constants';
import React, { createContext, useState, useEffect, ReactNode, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { getInspectionsToSync, markInspectionSynced, deleteInspectionOffline, type LocalInspectionData, updateSyncedInspectionPhotos } from '@/lib/indexedDB';
import { addDoc, collection, doc, setDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { useToast } from '@/hooks/use-toast';


interface AuthContextType {
  user: User | null;
  role: UserRole | null;
  loading: boolean;
  isSyncing: boolean;
  signIn: (method: 'email' | 'google', credentials?: { email?: string; password?: string }) => Promise<void>;
  signOut: () => Promise<void>;
  signUp?: (credentials: { email: string; password?: string; name?: string }) => Promise<void>;
  triggerSync?: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Helper to convert data URI to Blob
function dataURIToBlob(dataURI: string): Blob {
  const byteString = atob(dataURI.split(',')[1]);
  const mimeString = dataURI.split(',')[0].split(':')[1].split(';')[0];
  const ab = new ArrayBuffer(byteString.length);
  const ia = new Uint8Array(ab);
  for (let i = 0; i < byteString.length; i++) {
    ia[i] = byteString.charCodeAt(i);
  }
  return new Blob([ab], { type: mimeString });
}

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [hasMounted, setHasMounted] = useState(false);
  const router = useRouter();
  const isOnline = useOnlineStatus();
  const { toast } = useToast();

  useEffect(() => {
    setHasMounted(true);
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser: FirebaseUserType | null) => {
      if (firebaseUser) {
        const isAdmin = firebaseUser.email?.includes('admin');
        const userRole = isAdmin ? USER_ROLES.ADMIN : USER_ROLES.INSPECTOR;
        
        const appUser: User = {
          id: firebaseUser.uid,
          email: firebaseUser.email,
          name: firebaseUser.displayName,
          avatarUrl: firebaseUser.photoURL,
          role: userRole,
        };
        setUser(appUser);
        localStorage.setItem('iasl-user', JSON.stringify(appUser)); 
      } else {
        setUser(null);
        localStorage.removeItem('iasl-user');
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const syncOfflineData = useCallback(async () => {
    if (!isOnline || !user || isSyncing) return;

    setIsSyncing(true);
    toast({ title: "Sync Started", description: "Attempting to sync offline inspections." });
    console.log("Sync: Process started.");

    try {
      const inspectionsToSync = await getInspectionsToSync();
      console.log(`Sync: Found ${inspectionsToSync.length} inspections to sync.`);
      if (inspectionsToSync.length === 0) {
        toast({ title: "Sync Complete", description: "No new inspections to sync." });
        setIsSyncing(false);
        console.log("Sync: No inspections to sync. Process finished.");
        return;
      }

      let successCount = 0;
      for (const localInspection of inspectionsToSync) {
        try {
          console.log(`Sync: Processing inspection ${localInspection.localId}`);
          const uploadedPhotoMetadatas: Array<{ name: string; url: string }> = [];
          for (const clientPhoto of localInspection.photos) {
            if (clientPhoto.dataUri) { 
              const photoBlob = dataURIToBlob(clientPhoto.dataUri);
              const photoName = clientPhoto.name || `photo_${Date.now()}`;
              const photoRef = ref(storage, `inspections/${localInspection.localId}/${photoName}`);
              console.log(`Sync: Uploading photo ${photoName} for inspection ${localInspection.localId}`);
              await uploadBytes(photoRef, photoBlob);
              const downloadURL = await getDownloadURL(photoRef);
              uploadedPhotoMetadatas.push({ name: photoName, url: downloadURL });
              console.log(`Sync: Photo ${photoName} uploaded, URL: ${downloadURL}`);
            } else if (clientPhoto.url) { 
              uploadedPhotoMetadatas.push({ name: clientPhoto.name, url: clientPhoto.url });
            }
          }
          
          const { needsSync, localId, ...inspectionDataCore } = localInspection;
          const firestoreData: Omit<FirestoreInspectionData, 'id'> = {
            ...inspectionDataCore,
            localId: localInspection.localId, 
            photos: uploadedPhotoMetadatas, 
            timestamp: localInspection.timestamp || new Date().toISOString(), 
          };

          console.log(`Sync: Saving inspection ${localInspection.localId} to Firestore.`);
          const docRef = await addDoc(collection(firestore, "inspections"), firestoreData);
          await markInspectionSynced(localInspection.localId, docRef.id);
          await updateSyncedInspectionPhotos(localInspection.localId, uploadedPhotoMetadatas);

          successCount++;
          toast({ title: "Inspection Synced", description: `Truck ID ${localInspection.truckIdNo} synced successfully.` });
          console.log(`Sync: Inspection ${localInspection.localId} (Truck ID: ${localInspection.truckIdNo}) synced successfully with Firestore ID ${docRef.id}.`);
        } catch (itemError) {
          console.error(`Sync: Error syncing inspection item ${localInspection.localId}:`, itemError);
          toast({ 
            variant: "destructive", 
            title: "Sync Error for Item", 
            description: `Failed to sync Truck ID ${localInspection.truckIdNo}. Error: ${(itemError as Error).message}` 
          });
        }
      }
      toast({ title: "Sync Finished", description: `${successCount} of ${inspectionsToSync.length} inspections synced.` });
      console.log(`Sync: Process finished. ${successCount}/${inspectionsToSync.length} items synced.`);
    } catch (error) {
      console.error("Sync: General error during sync process:", error);
      toast({ 
        variant: "destructive", 
        title: "Sync Failed", 
        description: `An unexpected error occurred during the sync process. Details: ${(error as Error).message}` 
      });
    } finally {
      setIsSyncing(false);
    }
  }, [isOnline, user, toast, isSyncing]);


  useEffect(() => {
    if (isOnline && user && !isSyncing) {
      // Debounce or delay sync slightly to avoid rapid firing on multiple online events
      const timer = setTimeout(() => {
         syncOfflineData();
      }, 1000); // 1 second delay
      return () => clearTimeout(timer);
    }
  }, [isOnline, user, syncOfflineData, isSyncing]); // Added isSyncing to dependency array


  const signIn = useCallback(async (method: 'email' | 'google', credentials?: { email?: string; password?: string }) => {
    setLoading(true);
    try {
      if (method === 'email') {
        if (!credentials?.email || !credentials.password) {
          throw new Error('Email and password are required for email sign-in.');
        }
        await signInWithEmailAndPassword(auth, credentials.email, credentials.password);
      } else if (method === 'google') {
        const provider = new GoogleAuthProvider();
        await signInWithPopup(auth, provider);
      }
      router.push('/dashboard');
    } catch (error) {
      console.error("Sign in failed", error);
      throw error;
    }
  }, [router]);

  const signOut = useCallback(async () => {
    setLoading(true);
    try {
      await firebaseSignOut(auth);
      router.push('/auth/signin');
    } catch (error) {
      console.error("Sign out failed", error);
    }
  }, [router]);

  const signUp = useCallback(async (credentials: { email: string; password?: string; name?: string }) => {
    setLoading(true);
    if (!credentials.email || !credentials.password) {
        throw new Error("Email and password are required for sign up.");
    }
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, credentials.email, credentials.password);
      if (credentials.name && userCredential.user) {
        await updateProfile(userCredential.user, { displayName: credentials.name });
      }
      router.push('/dashboard');
    } catch (error) {
      console.error("Sign up failed", error);
      throw error;
    }
  }, [router]);

  const contextValue = useMemo(() => ({
    user,
    role: user?.role || null,
    loading: loading || !hasMounted,
    isSyncing,
    signIn,
    signOut,
    signUp,
    triggerSync: syncOfflineData,
  }), [user, loading, hasMounted, isSyncing, signIn, signOut, signUp, syncOfflineData]);

  if (!hasMounted) {
    return null; 
  }

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};

