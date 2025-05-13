// src/app/(app)/inspections/new/page.tsx
import { InspectionForm } from '@/components/inspection/InspectionForm';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FileEdit, Truck } from 'lucide-react'; // Changed icon to Truck

export const metadata = {
  title: 'New Truck Inspection | IASL EC Manager', // Updated title
};

export default function NewInspectionPage() {
  return (
    <div className="max-w-4xl mx-auto">
      <header className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-primary flex items-center gap-2">
            <Truck className="h-8 w-8" /> {/* Changed icon to Truck */}
            New Truck Inspection {/* Updated header text */}
        </h1>
        <p className="text-muted-foreground mt-1">
          Fill out the form below to record a new truck inspection.
        </p>
      </header>
      <InspectionForm />
    </div>
  );
}
