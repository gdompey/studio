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
  url: string; // Could be a signed URL for cloud storage, or a placeholder
  dataUri: string; // Base64 data URI, primarily for client-side use (AI, display)
}

export interface InspectionData {
  id: string;
  inspectorId: string;
  inspectorName?: string;
  truckIdNo: string; // Renamed from vin
  truckRegNo: string; // Added
  timestamp: string;
  photos: InspectionPhoto[];
  notes?: string;
  checklistAnswers: Record<string, any>;
  damageSummary?: string;
  latitude?: number;
  longitude?: number;
}

