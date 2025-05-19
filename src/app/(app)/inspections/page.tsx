// src/app/(app)/inspections/page.tsx
"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { FileText, PlusCircle, Search, Truck, Loader2 } from 'lucide-react';
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
import { collection, getDocs, query, orderBy, where, or } from 'firebase/firestore';
import { useAuth } from '@/hooks/useAuth';
import { USER_ROLES } from '@/lib/constants';


export default function InspectionsListPage() {
  const { user, role } = useAuth();
  const [inspections, setInspections] = useState<InspectionData[]>([]);
  const [filteredInspections, setFilteredInspections] = useState<InspectionData[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchInspections = async () => {
      if (!user) return;
      setLoading(true);
      try {
        const inspectionsCollectionRef = collection(firestore, 'inspections');
        let q;
        if (role === USER_ROLES.ADMIN) {
          q = query(inspectionsCollectionRef, orderBy('timestamp', 'desc'));
        } else {
          // Inspectors only see their own inspections
          q = query(inspectionsCollectionRef, where('inspectorId', '==', user.id), orderBy('timestamp', 'desc'));
        }
        
        const querySnapshot = await getDocs(q);
        const fetchedInspections: InspectionData[] = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...(doc.data() as Omit<InspectionData, 'id'>),
        }));
        setInspections(fetchedInspections);
        setFilteredInspections(fetchedInspections);
      } catch (error) {
        console.error("Error fetching inspections:", error);
        // Handle error (e.g., show toast)
      } finally {
        setLoading(false);
      }
    };

    fetchInspections();
  }, [user, role]);
  
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
            Browse, search, and manage all truck inspections.
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
            </div>
          ) : filteredInspections.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Truck ID No.</TableHead>
                  <TableHead>Truck Reg No.</TableHead>
                  <TableHead>Inspector</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Location (Lat, Lon)</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredInspections.map((inspection) => (
                  <TableRow key={inspection.id}>
                    <TableCell className="font-medium">{inspection.truckIdNo}</TableCell>
                    <TableCell>{inspection.truckRegNo}</TableCell>
                    <TableCell>{inspection.inspectorName || inspection.inspectorId}</TableCell>
                    <TableCell>{new Date(inspection.timestamp).toLocaleDateString()}</TableCell>
                    <TableCell>
                      {inspection.latitude && inspection.longitude 
                        ? `${inspection.latitude.toFixed(3)}, ${inspection.longitude.toFixed(3)}` 
                        : 'N/A'}
                    </TableCell>
                    <TableCell>
                      <Badge variant={inspection.damageSummary ? "destructive" : "default"} className={inspection.damageSummary ? "" : "bg-green-500 hover:bg-green-600"}>
                        {inspection.damageSummary ? "Damage Reported" : "No Major Damage"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button asChild variant="outline" size="sm">
                        <Link href={`/reports/${inspection.id}`}>View Report</Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
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
