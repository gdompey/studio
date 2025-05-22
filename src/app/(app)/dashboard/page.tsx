
// src/app/(app)/dashboard/page.tsx
"use client";

import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { 
  FilePlus2, Eye, BarChart3, ListChecks, CheckCircle, AlertTriangle, CloudOff, Loader2, UserCircle, Truck, CalendarDays, Filter, Building, Home as HomeIcon
} from 'lucide-react';
import { USER_ROLES } from '@/lib/constants';
import type { InspectionData, LocalInspectionData } from '@/types';
import { firestore } from '@/lib/firebase/config';
import { collection, getDocs, query, orderBy, Timestamp } from 'firebase/firestore';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { getOfflineInspections } from '@/lib/indexedDB';
import { useToast } from '@/hooks/use-toast';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { startOfDay, isToday, isAfter, subDays } from 'date-fns';

interface DashboardStats {
  total: number;
  released: number;
  damageReported: number;
  pendingSync: number;
}

const dateFilterOptions = [
  { value: 'all', label: 'All Time' },
  { value: 'today', label: 'Today' },
  { value: 'last7days', label: 'Last 7 Days' },
  { value: 'last30days', label: 'Last 30 Days' },
];

export default function DashboardPage() {
  const { user, role } = useAuth();
  const isOnline = useOnlineStatus();
  const { toast } = useToast();

  const [allInspections, setAllInspections] = useState<Array<InspectionData | LocalInspectionData>>([]);
  const [processedInspections, setProcessedInspections] = useState<Array<InspectionData | LocalInspectionData>>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentInspections, setRecentInspections] = useState<Array<InspectionData | LocalInspectionData>>([]);
  
  const [selectedDateFilter, setSelectedDateFilter] = useState<string>('all');
  const [selectedCompanyFilter, setSelectedCompanyFilter] = useState<string>('all');
  const [selectedWorkshopLocationFilter, setSelectedWorkshopLocationFilter] = useState<string>('all');
  const [availableCompanies, setAvailableCompanies] = useState<string[]>([]);
  const [availableWorkshopLocations, setAvailableWorkshopLocations] = useState<string[]>([]);


  const fetchAllInspectionsData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    let fetchedOnlineInspections: InspectionData[] = [];
    let fetchedOfflineInspections: LocalInspectionData[] = [];

    if (isOnline) {
      try {
        const inspectionsCollectionRef = collection(firestore, 'inspections');
        const q = query(inspectionsCollectionRef, orderBy('timestamp', 'desc'));
        
        const querySnapshot = await getDocs(q);
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
        console.error("Error fetching online inspections for dashboard:", error);
        toast({ variant: "destructive", title: "Network Error", description: "Could not fetch server inspections for dashboard." });
      }
    }

    try {
      fetchedOfflineInspections = await getOfflineInspections();
    } catch (error) {
      console.error("Error fetching offline inspections for dashboard:", error);
      toast({ variant: "destructive", title: "Local Data Error", description: "Could not load local inspections for dashboard." });
    }
    
    const combinedMap = new Map<string, InspectionData | LocalInspectionData>();
    
    fetchedOfflineInspections.forEach(item => {
      combinedMap.set(item.localId, { ...item }); 
    });

    fetchedOnlineInspections.forEach(item => {
      const keyForMap = item.localId || item.id; 
      combinedMap.set(keyForMap, { ...item, needsSync: item.needsSync === true ? 1 : 0 });
    });

    const combined = Array.from(combinedMap.values()).sort((a, b) => 
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
    
    setAllInspections(combined);

    const companies = new Set<string>();
    const workshopLocationsSet = new Set<string>();
    combined.forEach(insp => {
      const companyName = insp.checklistAnswers?.company_name as string;
      if (companyName && companyName.trim() !== "") {
        companies.add(companyName.trim());
      }
      const workshopLoc = insp.workshopLocation;
      if (workshopLoc && workshopLoc.trim() !== "") {
        workshopLocationsSet.add(workshopLoc.trim());
      }
    });
    setAvailableCompanies(Array.from(companies).sort());
    setAvailableWorkshopLocations(Array.from(workshopLocationsSet).sort());
    setLoading(false);

  }, [user, isOnline, toast]);

  useEffect(() => {
    if (user) {
      fetchAllInspectionsData();
    } else {
      setLoading(false); 
    }
  }, [user, fetchAllInspectionsData]);

  useEffect(() => {
    if (loading) return;

    let filtered = [...allInspections];

    // Apply Date Filter
    if (selectedDateFilter !== 'all') {
      const now = new Date();
      const todayStart = startOfDay(now);
      
      filtered = filtered.filter(insp => {
        const inspDate = new Date(insp.timestamp);
        if (selectedDateFilter === 'today') {
          return isToday(inspDate);
        }
        if (selectedDateFilter === 'last7days') {
          return isAfter(inspDate, subDays(todayStart, 7));
        }
        if (selectedDateFilter === 'last30days') {
          return isAfter(inspDate, subDays(todayStart, 30));
        }
        return true;
      });
    }

    // Apply Company Filter
    if (selectedCompanyFilter !== 'all') {
      filtered = filtered.filter(insp => {
        const companyName = insp.checklistAnswers?.company_name as string;
        return companyName === selectedCompanyFilter;
      });
    }

    // Apply Workshop Location Filter
    if (selectedWorkshopLocationFilter !== 'all') {
      filtered = filtered.filter(insp => insp.workshopLocation === selectedWorkshopLocationFilter);
    }
    
    setProcessedInspections(filtered);

    // Calculate stats based on processed inspections
    const total = filtered.length;
    const released = filtered.filter(insp => insp.isReleased).length;
    const damageReported = filtered.filter(insp => insp.damageSummary && insp.damageSummary.trim() !== "").length;
    // Pending sync is global, not based on filtered set.
    const pendingSync = allInspections.filter(insp => (insp as LocalInspectionData).needsSync === 1).length;
    
    setStats({ total, released, damageReported, pendingSync });
    setRecentInspections(filtered.slice(0, 5));

  }, [allInspections, selectedDateFilter, selectedCompanyFilter, selectedWorkshopLocationFilter, loading]);


  if (loading && allInspections.length === 0) { // Show loader only on initial full load
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-10rem)]">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }
  
  if (!user) return null; 

  return (
    <div className="space-y-8">
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="text-3xl font-bold text-primary">Welcome, {user.name || user.email}!</CardTitle>
          <CardDescription className="text-lg">
            You are logged in as an <span className="font-semibold text-accent">{role === USER_ROLES.ADMIN ? 'Administrator' : 'Inspector'}</span>.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Overview of vehicle inspection activities. {!isOnline && <span className="text-destructive font-semibold">(Offline Mode)</span>}
          </p>
        </CardContent>
      </Card>

      {/* Filters Section */}
      <Card className="shadow-md">
        <CardHeader>
          <CardTitle className="text-xl flex items-center gap-2"><Filter className="h-5 w-5 text-primary"/> Filters</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <Label htmlFor="date-filter" className="text-sm font-medium">Date Range</Label>
            <Select value={selectedDateFilter} onValueChange={setSelectedDateFilter}>
              <SelectTrigger id="date-filter">
                <SelectValue placeholder="Select date range" />
              </SelectTrigger>
              <SelectContent>
                {dateFilterOptions.map(option => (
                  <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="company-filter" className="text-sm font-medium">Company</Label>
            <Select value={selectedCompanyFilter} onValueChange={setSelectedCompanyFilter} disabled={availableCompanies.length === 0 && selectedCompanyFilter === 'all'}>
              <SelectTrigger id="company-filter">
                <SelectValue placeholder="Select company" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Companies</SelectItem>
                {availableCompanies.map(company => (
                  <SelectItem key={company} value={company}>{company}</SelectItem>
                ))}
              </SelectContent>
            </Select>
             {availableCompanies.length === 0 && <p className="text-xs text-muted-foreground mt-1">No company data found in inspections.</p>}
          </div>
          <div>
            <Label htmlFor="workshop-location-filter" className="text-sm font-medium">Workshop Location</Label>
            <Select value={selectedWorkshopLocationFilter} onValueChange={setSelectedWorkshopLocationFilter} disabled={availableWorkshopLocations.length === 0 && selectedWorkshopLocationFilter === 'all'}>
              <SelectTrigger id="workshop-location-filter">
                <SelectValue placeholder="Select workshop" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Workshops</SelectItem>
                {availableWorkshopLocations.map(location => (
                  <SelectItem key={location} value={location}>{location}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {availableWorkshopLocations.length === 0 && <p className="text-xs text-muted-foreground mt-1">No workshop data found in inspections.</p>}
          </div>
        </CardContent>
      </Card>


      {/* Stats Section */}
      {stats && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card className="shadow-md hover:shadow-lg transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Inspections (Filtered)</CardTitle>
              <ListChecks className="h-5 w-5 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total}</div>
              <p className="text-xs text-muted-foreground">Matching current filters</p>
            </CardContent>
          </Card>
          <Card className="shadow-md hover:shadow-lg transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Vehicles Released</CardTitle>
              <CheckCircle className="h-5 w-5 text-muted-foreground text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.released}</div>
              <p className="text-xs text-muted-foreground">In filtered set</p>
            </CardContent>
          </Card>
          <Card className="shadow-md hover:shadow-lg transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Damage Reported</CardTitle>
              <AlertTriangle className="h-5 w-5 text-muted-foreground text-red-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.damageReported}</div>
              <p className="text-xs text-muted-foreground">In filtered set</p>
            </CardContent>
          </Card>
          <Card className="shadow-md hover:shadow-lg transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending Sync (Overall)</CardTitle>
              <CloudOff className="h-5 w-5 text-muted-foreground text-orange-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.pendingSync}</div>
              <p className="text-xs text-muted-foreground">Inspections saved locally</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Actions Section */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {role === USER_ROLES.INSPECTOR && (
          <Card className="hover:shadow-xl transition-shadow">
            <CardHeader>
              <FilePlus2 className="h-10 w-10 text-accent mb-2" />
              <CardTitle>New Inspection</CardTitle>
              <CardDescription>Start a new vehicle inspection checklist.</CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild className="w-full bg-accent hover:bg-accent/90 text-accent-foreground">
                <Link href="/inspections/new">Start Inspection</Link>
              </Button>
            </CardContent>
          </Card>
        )}

        <Card className="hover:shadow-xl transition-shadow">
          <CardHeader>
            <Eye className="h-10 w-10 text-primary mb-2" />
            <CardTitle>View Inspections</CardTitle>
            <CardDescription>Review past and ongoing inspections.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline" className="w-full">
              <Link href="/inspections">Browse Inspections</Link>
            </Button>
          </CardContent>
        </Card>
        
        {role === USER_ROLES.ADMIN && (
           <Card className="hover:shadow-xl transition-shadow">
            <CardHeader>
              <BarChart3 className="h-10 w-10 text-destructive mb-2" />
              <CardTitle>Admin Panel</CardTitle>
              <CardDescription>Access user management and system settings.</CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild variant="outline" className="w-full">
                <Link href="/admin">Go to Admin Panel</Link>
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Recent Inspections Section */}
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="text-xl font-semibold text-primary">Recent Inspections (Filtered)</CardTitle>
           <CardDescription>A quick look at the latest inspection activities matching filters.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading && processedInspections.length === 0 ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-6 w-6 animate-spin text-primary mr-2" />
              <span>Loading or applying filters...</span>
            </div>
          ) : recentInspections.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead><Truck className="inline-block mr-1 h-4 w-4"/>Truck ID</TableHead>
                  <TableHead><Building className="inline-block mr-1 h-4 w-4"/>Company</TableHead>
                  <TableHead><HomeIcon className="inline-block mr-1 h-4 w-4"/>Workshop</TableHead>
                  <TableHead><CalendarDays className="inline-block mr-1 h-4 w-4"/>Date</TableHead>
                  <TableHead><UserCircle className="inline-block mr-1 h-4 w-4"/>Inspector</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentInspections.map((inspection) => {
                  const needsSync = (inspection as LocalInspectionData).needsSync === 1;
                  const linkId = (inspection.id && !needsSync) ? inspection.id : (inspection as LocalInspectionData).localId;
                  const keyId = (inspection as LocalInspectionData).localId || inspection.id;
                  const companyName = (inspection.checklistAnswers?.company_name as string) || 'N/A';
                  const workshopName = inspection.workshopLocation || 'N/A';
                  
                  let statusBadge = <Badge variant="default" className="bg-green-500 hover:bg-green-600">Clear</Badge>;
                  if (inspection.isReleased) {
                    statusBadge = <Badge variant="default" className="bg-blue-500 hover:bg-blue-600">Released</Badge>;
                  } else if (needsSync) {
                    statusBadge = <Badge variant="outline" className="border-orange-500 text-orange-600"><CloudOff className="mr-1 h-3 w-3" />Pending Sync</Badge>;
                  } else if (inspection.damageSummary) {
                    statusBadge = <Badge variant="destructive">Damage</Badge>;
                  }

                  return (
                    <TableRow key={keyId}>
                      <TableCell className="font-medium">{inspection.truckIdNo}</TableCell>
                      <TableCell>{companyName}</TableCell>
                      <TableCell>{workshopName}</TableCell>
                      <TableCell>{new Date(inspection.timestamp).toLocaleDateString()}</TableCell>
                      <TableCell>{inspection.inspectorName || (inspection as LocalInspectionData).inspectorId}</TableCell>
                      <TableCell>{statusBadge}</TableCell>
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
                  );
                })}
              </TableBody>
            </Table>
          ) : (
            <p className="text-muted-foreground text-center py-4">No recent inspection activity matches the current filters.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
