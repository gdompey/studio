
// src/app/(app)/inspections/page.tsx
"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { FileText, PlusCircle, Search, Truck, Loader2, CloudOff, ChevronLeft, ChevronRight } from 'lucide-react';
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
import { collection, getDocs, query, orderBy } from 'firebase/firestore'; // Removed 'where'
import { useAuth } from '@/hooks/useAuth';
import { USER_ROLES } from '@/lib/constants';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { getOfflineInspections, type LocalInspectionData } from '@/lib/indexedDB';
import { useToast } from '@/hooks/use-toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';

export default function InspectionsListPage() {
  const { user, role } = useAuth();
  const isOnline = useOnlineStatus();
  const { toast } = useToast();

  const [inspections, setInspections] = useState<Array<InspectionData | LocalInspectionData>>([]);
  const [filteredInspections, setFilteredInspections] = useState<Array<InspectionData | LocalInspectionData>>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);

  const [itemsPerPage, setItemsPerPage] = useState(50);
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    const fetchInspections = async () => {
      if (!user) return;
      setLoading(true);
      let fetchedOnlineInspections: InspectionData[] = [];
      let fetchedOfflineInspections: LocalInspectionData[] = [];

      if (isOnline) {
        try {
          const inspectionsCollectionRef = collection(firestore, 'inspections');
          // Fetch all inspections, ordered by timestamp for all roles
          const q = query(inspectionsCollectionRef, orderBy('timestamp', 'desc'));
          
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
        // Show all offline inspections to all users
        fetchedOfflineInspections = offlineData;
      } catch (error) {
        console.error("Error fetching offline inspections:", error);
        toast({ variant: "destructive", title: "Local Data Error", description: "Could not load local inspections." });
      }
      
      const combinedMap = new Map<string, InspectionData | LocalInspectionData>();
      
      // Add offline items first. If an online item with the same localId comes later,
      // the online version (from Firestore) will effectively update/replace it in the map
      // if item.localId is used as a key for online items too.
      fetchedOfflineInspections.forEach(item => {
        combinedMap.set(item.localId, { ...item }); 
      });

      fetchedOnlineInspections.forEach(item => {
        // Key by Firestore 'id' primarily. If it also has a 'localId' (meaning it was synced),
        // it will overwrite the purely local version if one existed in the map under that localId.
        // Or, if it's a new online-only item, it's added under its 'id'.
        const keyForMap = item.localId || item.id; // Use localId if present (synced item), else Firestore id.
                                                // This ensures that if an item was synced, its Firestore version
                                                // updates its local-only placeholder in the map.
        combinedMap.set(keyForMap, { ...item, needsSync: item.needsSync === true ? 1 : 0 });
      });

      const combinedInspections = Array.from(combinedMap.values()).sort((a, b) => 
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );
      
      setInspections(combinedInspections);
      setFilteredInspections(combinedInspections);
      setCurrentPage(1); // Reset to first page on new data fetch
      setLoading(false);
    };

    fetchInspections();
  }, [user, role, isOnline, toast]);
  
  useEffect(() => {
    setCurrentPage(1); // Reset to first page on search term change
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

  const totalPages = Math.ceil(filteredInspections.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedInspections = filteredInspections.slice(startIndex, endIndex);

  const handleItemsPerPageChange = (value: string) => {
      setItemsPerPage(Number(value));
      setCurrentPage(1); 
  };

  const goToNextPage = () => {
      setCurrentPage((prev) => Math.min(prev + 1, totalPages));
  };

  const goToPreviousPage = () => {
      setCurrentPage((prev) => Math.max(prev - 1, 1));
  };

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
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
            <div className="flex items-center space-x-2">
              <Search className="h-5 w-5 text-muted-foreground" />
              <Input 
                placeholder="Search by Truck ID, Reg No, or Inspector..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="max-w-sm"
              />
            </div>
            <div className="flex items-center space-x-2">
              <Label htmlFor="items-per-page-select" className="text-sm text-muted-foreground whitespace-nowrap">Items per page:</Label>
              <Select value={String(itemsPerPage)} onValueChange={handleItemsPerPageChange}>
                <SelectTrigger id="items-per-page-select" className="w-[80px]">
                  <SelectValue placeholder={itemsPerPage} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="50">50</SelectItem>
                  <SelectItem value="100">100</SelectItem>
                  <SelectItem value="200">200</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center items-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="ml-2">Loading inspections...</p>
            </div>
          ) : paginatedInspections.length > 0 ? (
            <>
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
                {paginatedInspections.map((inspection) => {
                  // Determine if the inspection needs sync.
                  // LocalInspectionData stores needsSync as number (0 or 1).
                  // InspectionData from Firestore might have it as boolean or undefined, or already converted to number by map.
                  const needsSync = ('needsSync' in inspection && typeof inspection.needsSync === 'number')
                    ? inspection.needsSync === 1
                    : (inspection as InspectionData).needsSync === true; // Fallback for data not yet conforming

                  // Determine the ID to use for the link.
                  // Prefer Firestore ID (inspection.id) if available and the item is considered synced.
                  // Otherwise, use localId (inspection.localId).
                  const isConsideredSynced = !!(inspection.id && !needsSync);
                  const linkId = isConsideredSynced ? inspection.id : (inspection as LocalInspectionData).localId;

                  // For React key, a stable unique ID is needed.
                  // inspection.localId is good if it exists (offline-first or synced from offline).
                  // Otherwise, inspection.id (Firestore ID for online-only items).
                  const keyId = (inspection as LocalInspectionData).localId || inspection.id;
                  
                  return (
                  <TableRow key={keyId}>
                    <TableCell className="font-medium">{inspection.truckIdNo}</TableCell>
                    <TableCell>{inspection.truckRegNo}</TableCell>
                    <TableCell>{inspection.inspectorName || (inspection as LocalInspectionData).inspectorId}</TableCell>
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
                      <Button asChild variant="outline" size="sm" disabled={!linkId}>
                        {linkId ? (
                          <Link href={`/reports/${linkId}`}>View Report</Link>
                        ) : (
                          <span>No ID</span> // Should not happen if keyId logic is sound
                        )}
                      </Button>
                    </TableCell>
                  </TableRow>
                )})}
              </TableBody>
            </Table>
             <div className="flex items-center justify-between pt-4">
                <span className="text-sm text-muted-foreground">
                  Page {currentPage} of {totalPages} ({filteredInspections.length} total inspections)
                </span>
                <div className="space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={goToPreviousPage}
                    disabled={currentPage === 1}
                  >
                    <ChevronLeft className="mr-1 h-4 w-4" />
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={goToNextPage}
                    disabled={currentPage === totalPages || totalPages === 0}
                  >
                    Next
                    <ChevronRight className="ml-1 h-4 w-4" />
                  </Button>
                </div>
              </div>
            </>
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

