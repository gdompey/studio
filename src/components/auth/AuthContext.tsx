
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
  updateProfile,
  sendPasswordResetEmail as firebaseSendPasswordResetEmail
} from 'firebase/auth';
import { auth, firestore, storage } from '@/lib/firebase/config'; 
import type { InspectionData as FirestoreInspectionData, User } from '@/types';
import type { UserRole } from '@/lib/constants';
import { USER_ROLES, APP_NAME } from '@/lib/constants';
import React, { createContext, useState, useEffect, ReactNode, useCallback, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { getInspectionsToSync, markInspectionSynced, type LocalInspectionData, updateSyncedInspectionPhotos } from '@/lib/indexedDB';
import { addDoc, collection, doc, setDoc, Timestamp, getDoc, serverTimestamp, updateDoc } from 'firebase/firestore';
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
  sendPasswordResetEmail: (email: string) => Promise<void>;
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

const SPECIAL_ADMIN_EMAIL = "gdompey@iauto.services";

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [hasMounted, setHasMounted] = useState(false);
  const router = useRouter();
  const isOnline = useOnlineStatus();
  const { toast } = useToast();
  const isSyncingRef = useRef(false); 

  const manageUserProfile = useCallback(async (firebaseUser: FirebaseUserType, isNewUser: boolean = false, displayName?: string | null) => {
    const userDocRef = doc(firestore, 'users', firebaseUser.uid);
    let userRole: UserRole = USER_ROLES.INSPECTOR;
    let userProfileData: Partial<User> = {};

    if (firebaseUser.email === SPECIAL_ADMIN_EMAIL) {
      userRole = USER_ROLES.ADMIN;
    }

    try {
      const docSnap = await getDoc(userDocRef);
      if (docSnap.exists()) {
        // User profile exists
        const existingData = docSnap.data() as User;
        userRole = firebaseUser.email === SPECIAL_ADMIN_EMAIL ? USER_ROLES.ADMIN : existingData.role || USER_ROLES.INSPECTOR;
        
        userProfileData = {
          ...existingData,
          name: displayName || firebaseUser.displayName || existingData.name,
          email: firebaseUser.email,
          avatarUrl: firebaseUser.photoURL || existingData.avatarUrl,
          role: userRole, // Ensure admin override
          lastLoginAt: Timestamp.now().toDate().toISOString(),
        };
        await updateDoc(userDocRef, {
            name: userProfileData.name,
            email: userProfileData.email,
            avatarUrl: userProfileData.avatarUrl,
            role: userProfileData.role,
            lastLoginAt: userProfileData.lastLoginAt,
        });

      } else {
        // New user or profile doesn't exist, create it
        userProfileData = {
          id: firebaseUser.uid,
          email: firebaseUser.email,
          name: displayName || firebaseUser.displayName,
          avatarUrl: firebaseUser.photoURL,
          role: userRole,
          isDisabled: false,
          createdAt: Timestamp.now().toDate().toISOString(),
          lastLoginAt: Timestamp.now().toDate().toISOString(),
        };
        await setDoc(userDocRef, userProfileData);
      }
      
      const appUser: User = {
        id: firebaseUser.uid,
        email: userProfileData.email,
        name: userProfileData.name,
        avatarUrl: userProfileData.avatarUrl,
        role: userProfileData.role!,
        isDisabled: userProfileData.isDisabled,
        createdAt: userProfileData.createdAt,
        lastLoginAt: userProfileData.lastLoginAt,
      };
      setUser(appUser);
      localStorage.setItem(`${APP_NAME}-user`, JSON.stringify(appUser));

      if(appUser.isDisabled) {
        toast({variant: "destructive", title: "Account Disabled", description: "Your account has been disabled. Please contact an administrator."});
        await firebaseSignOut(auth); // Sign out disabled user
        return null; // Return null to signify disabled user
      }
      return appUser;

    } catch (error) {
      console.error("Error managing user profile in Firestore:", error);
      toast({variant: "destructive", title: "Profile Error", description: "Could not load or create user profile."});
      // Fallback to basic user data if Firestore fails, but without role from DB
      const fallbackUser: User = {
          id: firebaseUser.uid,
          email: firebaseUser.email,
          name: firebaseUser.displayName,
          avatarUrl: firebaseUser.photoURL,
          role: firebaseUser.email === SPECIAL_ADMIN_EMAIL ? USER_ROLES.ADMIN : USER_ROLES.INSPECTOR, // Default role on error
      };
      setUser(fallbackUser);
      localStorage.setItem(`${APP_NAME}-user`, JSON.stringify(fallbackUser));
      return fallbackUser;
    }
  }, [toast]);


  useEffect(() => {
    setHasMounted(true);
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser: FirebaseUserType | null) => {
      if (firebaseUser) {
        const appUser = await manageUserProfile(firebaseUser);
        if (!appUser) { // User is disabled or profile management failed critically
            setUser(null);
            localStorage.removeItem(`${APP_NAME}-user`);
        }
      } else {
        setUser(null);
        localStorage.removeItem(`${APP_NAME}-user`);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [manageUserProfile]);


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
        setIsSyncing(false); 
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
          
          const { localId: currentLocalId, id: firestoreIdToUse, needsSync, photos, ...inspectionDataCore } = localInspection;
          
          const firestoreData: Omit<FirestoreInspectionData, 'id'> & { localId?: string } = {
            ...inspectionDataCore, 
            localId: currentLocalId, 
            photos: uploadedPhotoMetadatas.length > 0 ? uploadedPhotoMetadatas : localInspection.photos.map(p => ({name: p.name, url:p.url || ''})),
            timestamp: localInspection.timestamp ? Timestamp.fromDate(new Date(localInspection.timestamp)) as any : Timestamp.now() as any,
            isReleased: localInspection.isReleased,
            releasedAt: localInspection.releasedAt ? Timestamp.fromDate(new Date(localInspection.releasedAt)) as any : null,
            releasedByUserId: localInspection.releasedByUserId,
            releasedByUserName: localInspection.releasedByUserName,
          };


          if (firestoreIdToUse) { 
            console.log(`Sync: Updating existing inspection ${firestoreIdToUse} (local: ${currentLocalId}) in Firestore.`);
            const docRef = doc(firestore, "inspections", firestoreIdToUse);
            await setDoc(docRef, firestoreData, { merge: true });
            await markInspectionSynced(currentLocalId, firestoreIdToUse);
          } else { 
            console.log(`Sync: Saving new inspection ${currentLocalId} to Firestore.`);
            const docRef = await addDoc(collection(firestore, "inspections"), firestoreData);
            await markInspectionSynced(currentLocalId, docRef.id);
          }
          
          await updateSyncedInspectionPhotos(currentLocalId, firestoreData.photos as Array<{name: string; url: string}>);

          successCount++;
          toast({ title: "Inspection Synced", description: `Truck ID ${localInspection.truckIdNo} synced successfully.` });
          console.log(`Sync: Inspection ${currentLocalId} (Truck ID: ${localInspection.truckIdNo}) synced/updated successfully.`);
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
      isSyncingRef.current = false;
      setIsSyncing(false);
    }
  }, [isOnline, user, toast, manageUserProfile]); 


  useEffect(() => {
    if (isOnline && user && !isSyncingRef.current && !user.isDisabled) {
      const timer = setTimeout(() => {
         syncOfflineData({ showNoItemsToSyncToast: false });
      }, 1000); 
      return () => clearTimeout(timer);
    }
  }, [isOnline, user, syncOfflineData]); 


  const signIn = useCallback(async (method: 'email' | 'google', credentials?: { email?: string; password?: string }) => {
    setLoading(true);
    try {
      let firebaseUser: FirebaseUserType | null = null;
      if (method === 'email') {
        if (!credentials?.email || !credentials.password) {
          throw new Error('Email and password are required for email sign-in.');
        }
        const userCredential = await signInWithEmailAndPassword(auth, credentials.email, credentials.password);
        firebaseUser = userCredential.user;
      } else if (method === 'google') {
        const provider = new GoogleAuthProvider();
        const userCredential = await signInWithPopup(auth, provider);
        firebaseUser = userCredential.user;
      }
      
      if (firebaseUser) {
        const appUser = await manageUserProfile(firebaseUser);
        if (appUser && !appUser.isDisabled) {
          router.push('/dashboard');
          toast({ title: 'Signed in successfully!' });
        } else if (appUser?.isDisabled) {
          // Already handled by manageUserProfile, but as a safeguard:
          await firebaseSignOut(auth);
          router.push('/auth/signin'); // Stay on signin page
        } else {
           throw new Error('Failed to manage user profile after sign-in.');
        }
      } else {
        throw new Error('Sign in process did not return a user.');
      }

    } catch (error) {
      console.error("Sign in failed", error);
      toast({
        title: 'Sign in failed',
        description: (error as Error).message || 'Please check your credentials and try again.',
        variant: 'destructive',
      });
      throw error; // Re-throw for form to handle
    } finally {
      setLoading(false);
    }
  }, [router, toast, manageUserProfile]);

  const signOut = useCallback(async () => {
    setLoading(true);
    try {
      await firebaseSignOut(auth);
      setUser(null);
      localStorage.removeItem(`${APP_NAME}-user`);
      router.push('/auth/signin');
    } catch (error) {
      console.error("Sign out failed", error);
      toast({ title: "Sign Out Error", description: (error as Error).message, variant: "destructive"});
    } finally {
      setLoading(false);
    }
  }, [router, toast]);

  const signUp = useCallback(async (credentials: { email: string; password?: string; name?: string }) => {
    setLoading(true);
    if (!credentials.email || !credentials.password) {
        setLoading(false);
        throw new Error("Email and password are required for sign up.");
    }
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, credentials.email, credentials.password);
      if (userCredential.user) {
        if (credentials.name) {
            await updateProfile(userCredential.user, { displayName: credentials.name });
        }
        // manageUserProfile will create the Firestore doc and set the user state
        const appUser = await manageUserProfile(userCredential.user, true, credentials.name);
        if(appUser) {
            router.push('/dashboard');
            toast({ title: 'Account created successfully!' });
        } else {
            throw new Error("Failed to finalize user profile after sign up.");
        }
      } else {
         throw new Error("User creation did not return a user object.");
      }
    } catch (error) {
      console.error("Sign up failed", error);
      toast({
        title: 'Sign up failed',
        description: (error as Error).message || 'An error occurred. Please try again.',
        variant: 'destructive',
      });
      throw error; // Re-throw for form to handle
    } finally {
        setLoading(false);
    }
  }, [router, toast, manageUserProfile]);

  const sendPasswordResetEmail = useCallback(async (email: string) => {
    try {
      await firebaseSendPasswordResetEmail(auth, email);
      toast({ title: "Password Reset Email Sent", description: `If an account exists for ${email}, a password reset link has been sent.` });
    } catch (error) {
      console.error("Error sending password reset email:", error);
      toast({ variant: "destructive", title: "Password Reset Failed", description: (error as Error).message });
      throw error;
    }
  }, [toast]);


  const contextValue = useMemo(() => ({
    user,
    role: user?.role || null,
    loading: loading || !hasMounted,
    isSyncing,
    signIn,
    signOut,
    signUp,
    triggerSync: (opts?: { showNoItemsToSyncToast?: boolean }) => syncOfflineData(opts ?? { showNoItemsToSyncToast: true }),
    sendPasswordResetEmail,
  }), [user, loading, hasMounted, isSyncing, signIn, signOut, signUp, syncOfflineData, sendPasswordResetEmail]);

  if (!hasMounted) {
    return null; 
  }

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};
