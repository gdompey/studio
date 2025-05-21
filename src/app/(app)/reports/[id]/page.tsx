// src/app/(app)/reports/[id]/page.tsx
"use client";

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { ReportView } from '@/components/report/ReportView';
import type { InspectionData } from '@/types';
import { Button } from '@/components/ui/button';
import { Printer, AlertTriangle, Loader2 } from 'lucide-react';
import { firestore } from '@/lib/firebase/config';
import { doc, getDoc } from 'firebase/firestore';
import { getInspectionByIdOffline, type LocalInspectionData } from '@/lib/indexedDB';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';

export default function ReportPage() {
  const params = useParams();
  const reportId = params.id as string; // This could be Firestore ID or localId
  const [reportData, setReportData] = useState<InspectionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const isOnline = useOnlineStatus();

  useEffect(() => {
    if (reportId) {
      const fetchReport = async () => {
        setLoading(true);
        setError(null);
        try {
          let data: InspectionData | LocalInspectionData | undefined | null = null;
          
          // Try fetching from Firestore if online or if ID doesn't look like a localId
          if (isOnline && !reportId.startsWith('offline_')) {
            const reportDocRef = doc(firestore, 'inspections', reportId);
            const docSnap = await getDoc(reportDocRef);
            if (docSnap.exists()) {
              data = { id: docSnap.id, ...docSnap.data(), timestamp: docSnap.data().timestamp.toDate ? docSnap.data().timestamp.toDate().toISOString() : docSnap.data().timestamp } as InspectionData;
            }
          }
          
          // If not found online (or offline, or ID is local) try IndexedDB
          if (!data) {
            const localData = await getInspectionByIdOffline(reportId);
            if (localData) {
               data = {
                ...localData,
                id: localData.id || localData.localId, // Prioritize Firestore ID if synced
                photos: localData.photos.map(p => ({ name: p.name, url: p.dataUri || p.url || '' })),
              };
            }
          }

          if (data) {
            setReportData(data as InspectionData);
          } else {
            setError(`Report with ID ${reportId} not found.`);
          }
        } catch (e) {
          setError("Failed to load report data.");
          console.error(e);
        } finally {
          setLoading(false);
        }
      };
      fetchReport();
    }
  }, [reportId, isOnline]);

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return <div className="flex items-center justify-center min-h-[calc(100vh-10rem)]"><Loader2 className="h-10 w-10 animate-spin text-primary"/></div>;
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-10rem)] text-destructive p-4">
        <AlertTriangle className="h-12 w-12 mb-4" />
        <h2 className="text-xl font-semibold mb-2">Error Loading Report</h2>
        <p>{error}</p>
      </div>
    );
  }

  if (!reportData) {
    return (
       <div className="flex flex-col items-center justify-center min-h-[calc(100vh-10rem)] text-muted-foreground p-4">
        <AlertTriangle className="h-12 w-12 mb-4" />
        <p>Report data is not available.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center print:hidden">
        <h1 className="text-2xl font-bold text-primary">Inspection Report</h1>
        <Button onClick={handlePrint} variant="outline" className="bg-accent hover:bg-accent/90 text-accent-foreground">
          <Printer className="mr-2 h-4 w-4" />
          Print Report
        </Button>
      </div>
      <div className="print:p-0"> {/* Remove padding for print */}
        <ReportView reportData={reportData} />
      </div>
    </div>
  );
}
