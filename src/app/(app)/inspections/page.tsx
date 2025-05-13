// src/app/(app)/inspections/page.tsx
"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { FileText, PlusCircle, Search, Truck } from 'lucide-react';
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

// Mock data - in a real app, this would come from an API
const getMockInspections = (): InspectionData[] => {
  const inspections: InspectionData[] = [];
  for (let i = 1; i <= 5; i++) {
    const id = `mock-id-${i}`;
    const stored = typeof window !== 'undefined' ? localStorage.getItem(`inspection-${id}`) : null;
    if (stored) {
      inspections.push(JSON.parse(stored));
    } else {
      // Create some default mock data if not found in localStorage
      inspections.push({
        id: id,
        inspectorId: `inspector-${i}`,
        inspectorName: `Inspector ${i}`,
        truckIdNo: `TRUCKIDMOCK00${i}`, // Renamed from vin
        truckRegNo: `REGNO00${i}`, // Added
        timestamp: new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString(),
        photos: [],
        notes: `This is a mock inspection note for truck ${i}.`,
        checklistAnswers: { exterior_damage_present: i % 2 === 0 ? 'Yes' : 'No', fuel_quantity: '1/2 Tank' },
        damageSummary: i % 2 === 0 ? `Some damage noted on truck ${i}.` : undefined,
      });
    }
  }
  return inspections.sort((a,b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
};


export default function InspectionsListPage() {
  const [inspections, setInspections] = useState<InspectionData[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    setInspections(getMockInspections());
  }, []);
  
  const filteredInspections = inspections.filter(inspection => 
    inspection.truckIdNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
    inspection.truckRegNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
    inspection.inspectorName?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-primary flex items-center gap-2">
            <Truck className="h-8 w-8" /> {/* Changed icon to Truck */}
            Truck Inspections
          </h1>
          <p className="text-muted-foreground mt-1">
            Browse, search, and manage all truck inspections.
          </p>
        </div>
        <Button asChild className="bg-accent hover:bg-accent/90 text-accent-foreground">
          <Link href="/inspections/new">
            <PlusCircle className="mr-2 h-4 w-4" />
            New Inspection
          </Link>
        </Button>
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
          {filteredInspections.length > 0 ? (
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
                {filteredInspections.map((inspection) => (
                  <TableRow key={inspection.id}>
                    <TableCell className="font-medium">{inspection.truckIdNo}</TableCell>
                    <TableCell>{inspection.truckRegNo}</TableCell>
                    <TableCell>{inspection.inspectorName || inspection.inspectorId}</TableCell>
                    <TableCell>{new Date(inspection.timestamp).toLocaleDateString()}</TableCell>
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
