
import type { UserRole } from '@/lib/constants';

export interface User {
  id: string;
  email: string | null;
  name?: string | null;
  role: UserRole;
  avatarUrl?: string | null;
}

export interface ChecklistItemCondition {
  field: string;
  value: any; // Allow for boolean, string, etc.
}

export interface ChecklistItem {
  id: string;
  label: string;
  type: 'text' | 'textarea' | 'select' | 'checkbox' | 'radio' | 'photo';
  options?: string[]; // For select or radio
  dependencies?: string[]; // IDs of fields this field depends on
  conditions?: ChecklistItemCondition[]; // Conditions for this field to be active/visible
  required?: boolean;
  roles?: UserRole[]; // Roles that can see/interact with this field
}

export interface InspectionPhoto {
  name: string;
  url: string; // Firebase Storage download URL after upload.
  dataUri?: string; // Base64 data URI, for client-side preview/processing before upload and for offline storage.
  // Optional: localPath or blob reference if not storing full dataUri in some scenarios
}

// Represents the data structure primarily for Firestore
export interface InspectionData {
  id: string; // Firestore document ID
  localId?: string; // Client-generated ID, used for offline tracking, stored in Firestore for reconciliation
  inspectorId: string;
  inspectorName?: string;
  truckIdNo: string;
  truckRegNo: string;
  timestamp: string; // ISO string
  photos: Array<{ name: string; url: string; }>; // For Firestore, always store name and Firebase Storage URL
  notes?: string;
  checklistAnswers: Record<string, any>;
  damageSummary?: string;
  latitude?: number;
  longitude?: number;
  needsSync?: boolean; // Should ideally not be in Firestore schema, but useful for merged view

  // New fields for vehicle release
  isReleased?: boolean;
  releasedAt?: string | null; // ISO string or null
  releasedByUserId?: string;
  releasedByUserName?: string;
}
