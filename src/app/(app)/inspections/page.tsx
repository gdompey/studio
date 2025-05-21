// src/app/(app)/inspections/page.tsx
"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { FileText, PlusCircle, Search, Truck, Loader2, CloudOff } from 'lucide-react';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from '@/components/ui/badge';
import type { InspectionData } from '@/types';
import { useEffect, useState } from 'react';
import { firestore } from '@/lib/firebase/config';
import { collection, getDocs, query, orderBy, where, Timestamp } from 'firebase/firestore';
import { useAuth } from '@/hooks/useAuth';
import { USER_ROLES } from '@/lib/constants';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { getOfflineInspections, type LocalInspectionData } from '@/lib/indexedDB';
import { useToast } from '@/hooks/use-toast';

export default function InspectionsListPage() {
  const { user, role } = useAuth();
  const isOnline = useOnlineStatus();
  const { toast } = useToast();

  const [inspections, setInspections] = useState<Array<InspectionData | LocalInspectionData>>([]); // Combined list
  const [filteredInspections, setFilteredInspections] = useState<Array<InspectionData | LocalInspectionData>>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchInspections = async () => {
      if (!user) return;
      setLoading(true);
      let fetchedOnlineInspections: InspectionData[] = [];
      let fetchedOfflineInspections: LocalInspectionData[] = [];

      if (isOnline) {
        try {
          const inspectionsCollectionRef = collection(firestore, 'inspections');
          let q;
          if (role === USER_ROLES.ADMIN) {
            q = query(inspectionsCollectionRef, orderBy('timestamp', 'desc'));
          } else {
            q = query(inspectionsCollectionRef, where('inspectorId', '==', user.id), orderBy('timestamp', 'desc'));
          }
          const querySnapshot = await getDocs(q);
          fetchedOnlineInspections = querySnapshot.docs.map(doc => ({
            id: doc.id,
            ...(doc.data() as Omit<InspectionData, 'id'>),
             timestamp: (doc.data().timestamp as any)?.toDate ? (doc.data().timestamp as any).toDate().toISOString() : doc.data().timestamp,
          }));
        } catch (error) {
          console.error("Error fetching online inspections:", error);
          toast({ variant: "destructive", title: "Network Error", description: "Could not fetch inspections from server." });
        }
      }

      try {
        const offlineData: LocalInspectionData[] = await getOfflineInspections();
        fetchedOfflineInspections = offlineData
            .filter(item => role === USER_ROLES.ADMIN || item.inspectorId === user.id);
      } catch (error) {
        console.error("Error fetching offline inspections:", error);
        toast({ variant: "destructive", title: "Local Data Error", description: "Could not load local inspections." });
      }
      
      const combinedMap = new Map<string, InspectionData | LocalInspectionData>();
      // Add offline items first, potentially marking them for sync view
      fetchedOfflineInspections.forEach(item => {
        combinedMap.set(item.localId, { ...item }); 
      });
      // Add online items, overwriting if a localId matches (meaning it's synced)
      // Or add if it's a new online-only item
      fetchedOnlineInspections.forEach(item => {
        const key = item.localId || item.id; // Prioritize localId for matching, then firestore id
        combinedMap.set(key, { ...item, needsSync: 0 }); // Synced items have needsSync = 0
      });


      const combinedInspections = Array.from(combinedMap.values()).sort((a, b) => 
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );
      
      setInspections(combinedInspections);
      setFilteredInspections(combinedInspections);
      setLoading(false);
    };

    fetchInspections();
  }, [user, role, isOnline, toast]);
  
  useEffect(() => {
    if (!searchTerm) {
      setFilteredInspections(inspections);
      return;
    }
    const lowerSearchTerm = searchTerm.toLowerCase();
    setFilteredInspections(
      inspections.filter(inspection => 
        inspection.truckIdNo.toLowerCase().includes(lowerSearchTerm) ||
        inspection.truckRegNo.toLowerCase().includes(lowerSearchTerm) ||
        (inspection.inspectorName && inspection.inspectorName.toLowerCase().includes(lowerSearchTerm))
      )
    );
  }, [searchTerm, inspections]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-primary flex items-center gap-2">
            <Truck className="h-8 w-8" /> 
            Truck Inspections
          </h1>
          <p className="text-muted-foreground mt-1">
            Browse, search, and manage all truck inspections. {!isOnline && <span className="text-destructive font-semibold">(Offline Mode)</span>}
          </p>
        </div>
        { role === USER_ROLES.INSPECTOR && (
        <Button asChild className="bg-accent hover:bg-accent/90 text-accent-foreground">
          <Link href="/inspections/new">
            <PlusCircle className="mr-2 h-4 w-4" />
            New Inspection
          </Link>
        </Button>
        )}
      </div>

      <Card className="shadow-lg">
        <CardHeader>
          <div className="flex items-center space-x-2">
            <Search className="h-5 w-5 text-muted-foreground" />
            <Input 
              placeholder="Search by Truck ID, Reg No, or Inspector..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="max-w-sm"
            />
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center items-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="ml-2">Loading inspections...</p>
            </div>
          ) : filteredInspections.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Truck ID No.</TableHead>
                  <TableHead>Truck Reg No.</TableHead>
                  <TableHead>Inspector</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredInspections.map((inspection) => {
                  // Determine if it's a LocalInspectionData or InspectionData for needsSync
                  const needsSync = 'needsSync' in inspection ? inspection.needsSync === 1 : (inspection as InspectionData).needsSync === true;
                  const displayId = 'localId' in inspection && inspection.localId ? inspection.localId : inspection.id;

                  return (
                  <TableRow key={displayId}>
                    <TableCell className="font-medium">{inspection.truckIdNo}</TableCell>
                    <TableCell>{inspection.truckRegNo}</TableCell>
                    <TableCell>{inspection.inspectorName || inspection.inspectorId}</TableCell>
                    <TableCell>{new Date(inspection.timestamp).toLocaleDateString()}</TableCell>
                    <TableCell>
                      {needsSync ? (
                        <Badge variant="outline" className="border-orange-500 text-orange-600">
                          <CloudOff className="mr-1 h-3 w-3" /> Pending Sync
                        </Badge>
                      ) : inspection.damageSummary ? (
                        <Badge variant="destructive">Damage Reported</Badge>
                      ) : (
                        <Badge variant="default" className="bg-green-500 hover:bg-green-600">No Major Damage</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button asChild variant="outline" size="sm">
                        <Link href={`/reports/${displayId}`}>View Report</Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                )})}
              </TableBody>
            </Table>
          ) : (
            <p className="text-center text-muted-foreground py-8">
              No inspections found matching your criteria.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
