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
  value: any;
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

export interface InspectionData {
  id: string;
  inspectorId: string;
  inspectorName?: string;
  vin: string;
  timestamp: string;
  photos: { name: string; url: string; dataUri?: string }[]; // dataUri is temporary for AI
  notes?: string;
  checklistAnswers: Record<string, any>;
  damageSummary?: string;
}
