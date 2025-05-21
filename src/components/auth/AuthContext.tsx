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

    try {
      const inspectionsToSync = await getInspectionsToSync();
      if (inspectionsToSync.length === 0) {
        toast({ title: "Sync Complete", description: "No inspections to sync." });
        setIsSyncing(false);
        return;
      }

      let successCount = 0;
      for (const localInspection of inspectionsToSync) {
        try {
          const uploadedPhotoMetadatas: Array<{ name: string; url: string }> = [];
          for (const clientPhoto of localInspection.photos) {
            if (clientPhoto.dataUri) { // Only upload if dataUri exists
              const photoBlob = dataURIToBlob(clientPhoto.dataUri);
              const photoName = clientPhoto.name || `photo_${Date.now()}`;
              // Use localInspection.localId for storage path predictability
              const photoRef = ref(storage, `inspections/${localInspection.localId}/${photoName}`);
              await uploadBytes(photoRef, photoBlob);
              const downloadURL = await getDownloadURL(photoRef);
              uploadedPhotoMetadatas.push({ name: photoName, url: downloadURL });
            } else if (clientPhoto.url) { // If it's an existing URL (less likely for needsSync=true items)
              uploadedPhotoMetadatas.push({ name: clientPhoto.name, url: clientPhoto.url });
            }
          }
          
          // Prepare data for Firestore, removing local-only fields
          const { needsSync, localId, ...inspectionDataCore } = localInspection;
          const firestoreData: Omit<FirestoreInspectionData, 'id'> = {
            ...inspectionDataCore,
            localId: localInspection.localId, // Keep localId for reconciliation
            photos: uploadedPhotoMetadatas, // Use newly uploaded photo URLs
            timestamp: localInspection.timestamp || new Date().toISOString(), // Ensure timestamp
          };

          // If the local inspection already has a Firestore 'id', it means it was synced before
          // but maybe photo uploads failed or something. In that case, update (setDoc with merge).
          // For now, assume new items are added. A more robust sync would handle updates.
          const docRef = await addDoc(collection(firestore, "inspections"), firestoreData);
          await markInspectionSynced(localInspection.localId, docRef.id);
          // Update local photos to remove dataUris and only keep URLs
          await updateSyncedInspectionPhotos(localInspection.localId, uploadedPhotoMetadatas);

          successCount++;
          toast({ title: "Inspection Synced", description: `Truck ID ${localInspection.truckIdNo} synced.` });
        } catch (itemError) {
          console.error("Error syncing inspection:", localInspection.localId, itemError);
          toast({ variant: "destructive", title: "Sync Error", description: `Failed to sync Truck ID ${localInspection.truckIdNo}.` });
        }
      }
      toast({ title: "Sync Finished", description: `${successCount} of ${inspectionsToSync.length} inspections synced.` });
    } catch (error) {
      console.error("Error during sync process:", error);
      toast({ variant: "destructive", title: "Sync Failed", description: "An error occurred during the sync process." });
    } finally {
      setIsSyncing(false);
    }
  }, [isOnline, user, toast, isSyncing]);


  useEffect(() => {
    if (isOnline && user && !isSyncing) {
      syncOfflineData();
    }
  }, [isOnline, user, syncOfflineData, isSyncing]);


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
