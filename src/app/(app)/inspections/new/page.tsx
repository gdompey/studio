// src/app/(app)/inspections/new/page.tsx
import { InspectionForm } from '@/components/inspection/InspectionForm';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FileEdit } from 'lucide-react';

export const metadata = {
  title: 'New Inspection | IASL EC Manager',
};

export default function NewInspectionPage() {
  return (
    <div className="max-w-4xl mx-auto">
      <header className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-primary flex items-center gap-2">
            <FileEdit className="h-8 w-8" />
            New Vehicle Inspection
        </h1>
        <p className="text-muted-foreground mt-1">
          Fill out the form below to record a new vehicle inspection.
        </p>
      </header>
      <InspectionForm />
    </div>
  );
}
