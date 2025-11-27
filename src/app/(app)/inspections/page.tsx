// src/app/(app)/inspections/page.tsx
"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { FileText, PlusCircle, Search, Truck, Loader2, CloudOff, ChevronLeft, ChevronRight, CheckSquare, Square } from 'lucide-react';
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
import { useEffect, useState, useCallback } from 'react';
import { firestore } from '@/lib/firebase/config';
import { collection, getDocs, query, orderBy, doc, updateDoc, Timestamp } from 'firebase/firestore';
import { useAuth } from '@/hooks/useAuth';
import { USER_ROLES } from '@/lib/constants';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { getOfflineInspections, type LocalInspectionData, updateInspectionOffline } from '@/lib/indexedDB';
import { useToast } from '@/hooks/use-toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { FirestorePermissionError } from '@/firebase/errors';
import { errorEmitter } from '@/firebase/error-emitter';

export default function InspectionsListPage() {
  const { user, role } = useAuth();
  const isOnline = useOnlineStatus();
  const { toast } = useToast();

  const [inspections, setInspections] = useState<Array<InspectionData | LocalInspectionData>>([]);
  const [filteredInspections, setFilteredInspections] = useState<Array<InspectionData | LocalInspectionData>>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [updatingRelease, setUpdatingRelease] = useState<string | null>(null); // To show loader on checkbox

  const [itemsPerPage, setItemsPerPage] = useState(50);
  const [currentPage, setCurrentPage] = useState(1);

  const fetchInspections = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    let fetchedOnlineInspections: InspectionData[] = [];
    let fetchedOfflineInspections: LocalInspectionData[] = [];

    if (isOnline) {
      try {
        const inspectionsCollectionRef = collection(firestore, 'inspections');
        const q = query(inspectionsCollectionRef, orderBy('timestamp', 'desc'));
        
        const querySnapshot = await getDocs(q).catch(serverError => {
            errorEmitter.emit('permission-error', new FirestorePermissionError({
                path: inspectionsCollectionRef.path,
                operation: 'list',
            }));
            throw serverError;
        });
        fetchedOnlineInspections = querySnapshot.docs.map(doc => {
          const data = doc.data() as Omit<InspectionData, 'id'>;
          return {
            id: doc.id,
            ...data,
            timestamp: (data.timestamp as any)?.toDate ? (data.timestamp as any).toDate().toISOString() : data.timestamp,
            releasedAt: (data.releasedAt as any)?.toDate ? (data.releasedAt as any).toDate().toISOString() : data.releasedAt,
          };
        });
      } catch (error) {
        console.error("Error fetching online inspections:", error);
        toast({ variant: "destructive", title: "Network Error", description: "Could not fetch inspections from server." });
      }
    }

    try {
      fetchedOfflineInspections = await getOfflineInspections();
    } catch (error) {
      console.error("Error fetching offline inspections:", error);
      toast({ variant: "destructive", title: "Local Data Error", description: "Could not load local inspections." });
    }
    
    const combinedMap = new Map<string, InspectionData | LocalInspectionData>();
    
    fetchedOfflineInspections.forEach(item => {
       const normalizedItem = {
        ...item,
        releasedAt: typeof item.releasedAt === 'object' && item.releasedAt !== null ? (item.releasedAt as any).toDate().toISOString() : item.releasedAt,
      };
      combinedMap.set(item.localId, { ...normalizedItem }); 
    });

    fetchedOnlineInspections.forEach(item => {
      const keyForMap = item.localId || item.id; 
      combinedMap.set(keyForMap, { ...item, needsSync: item.needsSync === true ? 1 : 0 });
    });

    const combinedInspections = Array.from(combinedMap.values()).sort((a, b) => 
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
    
    setInspections(combinedInspections);
    setLoading(false);
  }, [user, isOnline, toast]);


  useEffect(() => {
    fetchInspections();
  }, [fetchInspections]);
  
  useEffect(() => {
    setCurrentPage(1); 
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

  const handleSetReleaseStatus = async (inspection: InspectionData | LocalInspectionData, newReleasedState: boolean) => {
    if (!user) {
      toast({ title: "Error", description: "You must be logged in.", variant: "destructive" });
      return;
    }
    const currentInspectionId = (inspection as LocalInspectionData).localId || inspection.id;
    setUpdatingRelease(currentInspectionId);

    const releaseData: Partial<InspectionData> = {
      isReleased: newReleasedState,
      releasedAt: newReleasedState ? new Date().toISOString() : null,
      releasedByUserId: newReleasedState ? user.id : undefined, 
      releasedByUserName: newReleasedState ? (user.name || user.email) : undefined,
    };
    if (!newReleasedState) { 
        releaseData.releasedByUserId = null as any; 
        releaseData.releasedByUserName = null as any;
    }


    let success = false;
    // Try online update first if possible
    if (isOnline && inspection.id) {
        const inspectionDocRef = doc(firestore, 'inspections', inspection.id);
        const dataForFirestore = {
            ...releaseData,
            releasedAt: newReleasedState ? Timestamp.fromDate(new Date(releaseData.releasedAt!)) : null,
        };
        updateDoc(inspectionDocRef, dataForFirestore).then(async () => {
            toast({ title: "Success", description: `Vehicle release status updated for ${inspection.truckIdNo}.` });
            await updateInspectionOffline((inspection as LocalInspectionData).localId || inspection.id, { ...releaseData, needsSync: 0 });
            success = true;
            fetchInspections();
        }).catch(serverError => {
            errorEmitter.emit('permission-error', new FirestorePermissionError({
                path: inspectionDocRef.path,
                operation: 'update',
                requestResourceData: dataForFirestore
            }));
            toast({ title: "Online Update Failed", description: "Saving release status locally.", variant: "destructive" });
        }).finally(() => {
             if (!success) {
                updateInspectionOffline((inspection as LocalInspectionData).localId || inspection.id, { ...releaseData, needsSync: 1 })
                    .then(() => {
                         toast({ title: "Success", description: `Vehicle release status updated locally for ${inspection.truckIdNo}.` });
                         fetchInspections();
                    }).catch(offlineError => {
                        console.error("Error updating release status in IndexedDB:", offlineError);
                        toast({ title: "Local Update Failed", description: "Could not save release status.", variant: "destructive" });
                    });
            }
            setUpdatingRelease(null);
        });
        return; // exit function as we are handling everything in the promise chain
    }
    
    // Offline-only update
    try {
        await updateInspectionOffline((inspection as LocalInspectionData).localId || inspection.id, { ...releaseData, needsSync: 1 });
        toast({ title: "Success", description: `Vehicle release status updated locally for ${inspection.truckIdNo}.` });
        fetchInspections();
    } catch (error) {
        console.error("Error updating release status in IndexedDB:", error);
        toast({ title: "Local Update Failed", description: "Could not save release status.", variant: "destructive" });
    } finally {
        setUpdatingRelease(null);
    }
  };


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
                  <TableHead>Status / Released</TableHead>
                  <TableHead className="text-center">Released?</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedInspections.map((inspection) => {
                  const needsSync = ('needsSync' in inspection && typeof inspection.needsSync === 'number')
                    ? inspection.needsSync === 1
                    : (inspection as InspectionData).needsSync === true; 

                  const isConsideredSynced = !!(inspection.id && !needsSync);
                  // Use Firestore ID for link if synced and available, otherwise use localId
                  const linkId = (isConsideredSynced && inspection.id) ? inspection.id : (inspection as LocalInspectionData).localId;
                  const keyId = (inspection as LocalInspectionData).localId || inspection.id;
                  const currentItemId = (inspection as LocalInspectionData).localId || inspection.id;
                  
                  return (
                  <TableRow key={keyId}>
                    <TableCell className="font-medium">{inspection.truckIdNo}</TableCell>
                    <TableCell>{inspection.truckRegNo}</TableCell>
                    <TableCell>{inspection.inspectorName || (inspection as LocalInspectionData).inspectorId}</TableCell>
                    <TableCell>{new Date(inspection.timestamp).toLocaleDateString()}</TableCell>
                    <TableCell>
                      {inspection.isReleased ? (
                        <Badge variant="default" className="bg-blue-500 hover:bg-blue-600">
                          Released {inspection.releasedAt ? `on ${new Date(inspection.releasedAt).toLocaleDateString()}` : ''} 
                          {inspection.releasedByUserName ? ` by ${inspection.releasedByUserName}` : ''}
                        </Badge>
                      ) : needsSync ? (
                        <Badge variant="outline" className="border-orange-500 text-orange-600">
                          <CloudOff className="mr-1 h-3 w-3" /> Pending Sync
                        </Badge>
                      ) : inspection.damageSummary ? (
                        <Badge variant="destructive">Damage Reported</Badge>
                      ) : (
                        <Badge variant="default" className="bg-green-500 hover:bg-green-600">No Major Damage</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                        {updatingRelease === currentItemId ? (
                            <Loader2 className="h-5 w-5 animate-spin mx-auto text-primary" />
                        ) : (
                            <Checkbox
                                id={`release-${keyId}`}
                                checked={!!inspection.isReleased}
                                onCheckedChange={(checked) => {
                                    handleSetReleaseStatus(inspection, !!checked);
                                }}
                                aria-label={`Mark vehicle ${inspection.truckIdNo} as released`}
                            />
                        )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button asChild variant="outline" size="sm" disabled={!linkId}>
                        {linkId ? (
                          <Link href={`/reports/${linkId}`}>View Report</Link>
                        ) : (
                          <span>No ID</span>
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
