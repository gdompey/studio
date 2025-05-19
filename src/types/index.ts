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
  url: string; // Firebase Storage download URL after upload. Initially can be empty or placeholder.
  dataUri?: string; // Base64 data URI, for client-side preview/processing before upload. Optional after upload.
}

// Represents the data structure stored in Firestore
export interface InspectionData {
  id: string; // Firestore document ID
  inspectorId: string;
  inspectorName?: string;
  truckIdNo: string;
  truckRegNo: string;
  timestamp: string; // ISO string
  photos: Array<{ name: string; url: string; }>; // Only store name and Firebase Storage URL
  notes?: string;
  checklistAnswers: Record<string, any>;
  damageSummary?: string;
  latitude?: number;
  longitude?: number;
}
