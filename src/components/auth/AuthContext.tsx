
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
import type { InspectionData as FirestoreInspectionData, User } from '@/types';
import type { UserRole } from '@/lib/constants';
import { USER_ROLES } from '@/lib/constants';
import React, { createContext, useState, useEffect, ReactNode, useCallback, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { getInspectionsToSync, markInspectionSynced, type LocalInspectionData, updateSyncedInspectionPhotos } from '@/lib/indexedDB';
import { addDoc, collection, doc, setDoc, Timestamp } from 'firebase/firestore';
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
  triggerSync?: (options?: { showNoItemsToSyncToast?: boolean }) => Promise<void>;
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
  const isSyncingRef = useRef(false); 

  useEffect(() => {
    setHasMounted(true);
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser: FirebaseUserType | null) => {
      if (firebaseUser) {
        const isAdmin = firebaseUser.email?.includes('admin'); // Simplified role assignment
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

  const syncOfflineData = useCallback(async (options?: { showNoItemsToSyncToast?: boolean }) => {
    if (isSyncingRef.current) {
      console.log("Sync: Already in progress.");
      if (options?.showNoItemsToSyncToast) {
        toast({ title: "Sync Info", description: "Sync process is already running." });
      }
      return;
    }

    if (!isOnline || !user) {
      if (options?.showNoItemsToSyncToast && !isOnline) {
        toast({ title: "Sync Info", description: "Cannot sync while offline.", variant: "destructive" });
      }
      if (options?.showNoItemsToSyncToast && !user) {
        toast({ title: "Sync Info", description: "User not logged in. Cannot sync.", variant: "destructive" });
      }
      return;
    }

    isSyncingRef.current = true;
    setIsSyncing(true);

    const showNoItemsToast = options?.showNoItemsToSyncToast ?? false;

    toast({ title: "Sync Started", description: "Attempting to sync offline inspections." });
    console.log("Sync: Process started.");

    try {
      const inspectionsToSync = await getInspectionsToSync();
      console.log(`Sync: Found ${inspectionsToSync.length} inspections to sync.`);

      if (inspectionsToSync.length === 0) {
        if (showNoItemsToast) {
          toast({ title: "Sync Complete", description: "No new inspections to sync." });
        }
        console.log("Sync: No inspections to sync. Process finished (no items found).");
        setIsSyncing(false); // Ensure isSyncing is reset
        isSyncingRef.current = false;
        return; 
      }

      let successCount = 0;
      for (const localInspection of inspectionsToSync) {
        try {
          console.log(`Sync: Processing inspection ${localInspection.localId}, Firestore ID: ${localInspection.id}`);
          const uploadedPhotoMetadatas: Array<{ name: string; url: string }> = [];
          
          for (const clientPhoto of localInspection.photos) {
            if (clientPhoto.dataUri && !clientPhoto.url?.startsWith('https://firebasestorage.googleapis.com')) { 
              const photoBlob = dataURIToBlob(clientPhoto.dataUri);
              const photoName = clientPhoto.name || `photo_${Date.now()}`;
              // Use localId or Firestore ID if available for path predictability
              const storagePathId = localInspection.id || localInspection.localId;
              const photoRef = ref(storage, `inspections/${storagePathId}/${photoName}`);
              console.log(`Sync: Uploading photo ${photoName} for inspection ${storagePathId}`);
              await uploadBytes(photoRef, photoBlob);
              const downloadURL = await getDownloadURL(photoRef);
              uploadedPhotoMetadatas.push({ name: photoName, url: downloadURL });
              console.log(`Sync: Photo ${photoName} uploaded, URL: ${downloadURL}`);
            } else if (clientPhoto.url) { 
              uploadedPhotoMetadatas.push({ name: clientPhoto.name, url: clientPhoto.url });
            }
          }
          
          // Exclude localId and needsSync from the core data being spread.
          // id (Firestore ID) is handled separately.
          const { localId: currentLocalId, id: firestoreIdToUse, needsSync, ...inspectionDataCore } = localInspection;
          
          const firestoreData: Omit<FirestoreInspectionData, 'id'> & { localId?: string } = {
            ...inspectionDataCore, // This now correctly includes workshopLocation if present
            localId: currentLocalId, // Always include localId for traceability
            photos: uploadedPhotoMetadatas.length > 0 ? uploadedPhotoMetadatas : localInspection.photos.map(p => ({name: p.name, url:p.url || ''})),
            timestamp: localInspection.timestamp ? Timestamp.fromDate(new Date(localInspection.timestamp)) as any : Timestamp.now() as any,
            isReleased: localInspection.isReleased,
            releasedAt: localInspection.releasedAt ? Timestamp.fromDate(new Date(localInspection.releasedAt)) as any : null,
            releasedByUserId: localInspection.releasedByUserId,
            releasedByUserName: localInspection.releasedByUserName,
          };


          if (firestoreIdToUse) { // This inspection was previously synced or has a Firestore ID
            console.log(`Sync: Updating existing inspection ${firestoreIdToUse} (local: ${currentLocalId}) in Firestore.`);
            const docRef = doc(firestore, "inspections", firestoreIdToUse);
            await setDoc(docRef, firestoreData, { merge: true });
            await markInspectionSynced(currentLocalId, firestoreIdToUse);
          } else { // New inspection
            console.log(`Sync: Saving new inspection ${currentLocalId} to Firestore.`);
            const docRef = await addDoc(collection(firestore, "inspections"), firestoreData);
            await markInspectionSynced(currentLocalId, docRef.id);
          }
          
          // After successful Firestore operation, update local photos to use URLs and clear dataUris
          await updateSyncedInspectionPhotos(currentLocalId, firestoreData.photos as Array<{name: string; url: string}>);

          successCount++;
          toast({ title: "Inspection Synced", description: `Truck ID ${localInspection.truckIdNo} synced successfully.` });
          console.log(`Sync: Inspection ${currentLocalId} (Truck ID: ${localInspection.truckIdNo}) synced/updated successfully.`);
        } catch (itemError) {
          console.error(`Sync: Error syncing inspection item ${localInspection.localId}:`, itemError);
          toast({ 
            variant: "destructive", 
            title: "Sync Error for Item", 
            description: `Failed to sync Truck ID ${localInspection.truckIdNo}. Details: ${(itemError as Error).message}` 
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
        description: `An unexpected error occurred. Details: ${(error as Error).message}` 
      });
    } finally {
      isSyncingRef.current = false;
      setIsSyncing(false);
    }
  }, [isOnline, user, toast, isSyncingRef]); // Removed isSyncing from deps


  useEffect(() => {
    if (isOnline && user && !isSyncingRef.current) {
      const timer = setTimeout(() => {
         syncOfflineData({ showNoItemsToSyncToast: false });
      }, 1000); 
      return () => clearTimeout(timer);
    }
  }, [isOnline, user, syncOfflineData]); 


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
    } finally {
      setLoading(false); // ensure loading is set to false in finally
    }
  }, [router]);

  const signOut = useCallback(async () => {
    setLoading(true);
    try {
      await firebaseSignOut(auth);
      router.push('/auth/signin');
    } catch (error) {
      console.error("Sign out failed", error);
    } finally {
      setLoading(false); // ensure loading is set to false
    }
  }, [router]);

  const signUp = useCallback(async (credentials: { email: string; password?: string; name?: string }) => {
    setLoading(true);
    if (!credentials.email || !credentials.password) {
        setLoading(false);
        throw new Error("Email and password are required for sign up.");
    }
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, credentials.email, credentials.password);
      if (credentials.name && userCredential.user) {
        await updateProfile(userCredential.user, { displayName: credentials.name });
        // Re-fetch user or update local user state if necessary to reflect displayName
        const updatedFirebaseUser = auth.currentUser;
         if (updatedFirebaseUser) {
            const isAdmin = updatedFirebaseUser.email?.includes('admin');
            const userRole = isAdmin ? USER_ROLES.ADMIN : USER_ROLES.INSPECTOR;
            const appUser: User = {
                id: updatedFirebaseUser.uid,
                email: updatedFirebaseUser.email,
                name: updatedFirebaseUser.displayName,
                avatarUrl: updatedFirebaseUser.photoURL,
                role: userRole,
            };
            setUser(appUser);
            localStorage.setItem('iasl-user', JSON.stringify(appUser));
        }
      }
      router.push('/dashboard');
    } catch (error) {
      console.error("Sign up failed", error);
      throw error;
    } finally {
        setLoading(false);
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
    triggerSync: (opts?: { showNoItemsToSyncToast?: boolean }) => syncOfflineData(opts ?? { showNoItemsToSyncToast: true }),
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

