
// src/components/report/ReportView.tsx
"use client";

import type { InspectionData, InspectionPhoto as ClientInspectionPhoto } from '@/types'; 
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import Image from 'next/image';
import { User, CalendarDays, Truck, FileText, ShieldCheck, Camera, StickyNote, Wand2, MapPin, CheckSquare, Square, Home } from 'lucide-react'; // Added Home
import { APP_NAME } from '@/lib/constants';

interface ReportViewProps {
  reportData: InspectionData; 
}

export function ReportView({ reportData }: ReportViewProps) {
  const {
    id,
    inspectorId,
    inspectorName,
    truckIdNo,
    truckRegNo,
    workshopLocation, // Added workshopLocation
    timestamp,
    photos, 
    notes,
    checklistAnswers,
    damageSummary,
    latitude,
    longitude,
    isReleased,
    releasedAt,
    releasedByUserId,
    releasedByUserName,
  } = reportData;

  const Section: React.FC<{ title: string; icon: React.ElementType; children: React.ReactNode }> = ({ title, icon: Icon, children }) => (
    <div className="mb-6">
      <div className="flex items-center mb-3">
        <Icon className="h-6 w-6 mr-3 text-primary" />
        <h2 className="text-xl font-semibold text-primary">{title}</h2>
      </div>
      <div className="pl-9 space-y-2 text-sm">{children}</div>
      <Separator className="my-4 ml-9"/>
    </div>
  );

  const DataItem: React.FC<{ label: string; value?: string | number | null; children?: React.ReactNode }> = ({ label, value, children }) => (
    <div className="grid grid-cols-3 gap-2 items-start">
      <p className="font-medium text-foreground/80 col-span-1">{label}:</p>
      {value !== undefined && <p className="text-foreground col-span-2">{value || 'N/A'}</p>}
      {children && <div className="col-span-2">{children}</div>}
    </div>
  );

  const displayPhotos: ClientInspectionPhoto[] = photos.map(p => ({
    name: p.name,
    url: p.url, 
  }));

  return (
    <Card className="max-w-4xl mx-auto p-4 sm:p-8 shadow-xl print:shadow-none print:border-none">
      <CardHeader className="text-center border-b pb-6 mb-6 print:border-b-2 print:border-gray-300">
        <Image 
            src="/company-logo.png"
            alt={`${APP_NAME} Logo`}
            width={60}
            height={60}
            className="mx-auto rounded-lg shadow-sm mb-2 print:mb-1"
            data-ai-hint="company logo"
        />
        <CardTitle className="text-3xl font-bold text-primary print:text-2xl">{APP_NAME} - Vehicle Inspection Report</CardTitle>
        <CardDescription className="text-sm text-muted-foreground print:text-xs">Report ID: {id}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6 print:space-y-4">
        
        <Section title="Inspector Information" icon={User}>
          <DataItem label="Inspector ID" value={inspectorId} />
          <DataItem label="Inspector Name" value={inspectorName} />
        </Section>

        <Section title="Truck Details & Location" icon={Truck}>
          <DataItem label="Truck ID No." value={truckIdNo} />
          <DataItem label="Truck Reg No." value={truckRegNo} />
          <DataItem label="Workshop Location" value={workshopLocation} />
          <DataItem label="Inspection Date" value={new Date(timestamp).toLocaleString()} />
          {latitude && longitude && (
            <DataItem label="GPS Location">
              <p className="text-foreground col-span-2">
                Lat: {latitude.toFixed(6)}, Lon: {longitude.toFixed(6)}
                <a 
                  href={`https://www.google.com/maps?q=${latitude},${longitude}`} 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="ml-2 text-accent hover:underline text-xs"
                >
                  (View on Map)
                </a>
              </p>
            </DataItem>
          )}
        </Section>

        <Section title="Checklist Summary" icon={FileText}>
          {Object.entries(checklistAnswers).length > 0 ? (
            Object.entries(checklistAnswers).map(([key, value]) => (
              <DataItem key={key} label={key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}>
                {typeof value === 'boolean' ? (
                  <Badge variant={value ? 'default' : 'destructive'} className={value ? 'bg-green-500 hover:bg-green-600' : 'bg-red-500 hover:bg-red-600'}>
                    {value ? 'Yes' : 'No'}
                  </Badge>
                ) : Array.isArray(value) && value.every(item => typeof item === 'string' && item.startsWith('data:image')) ? (
                  <span>{value.length} photo(s) uploaded for this item</span>
                ) : Array.isArray(value) && value.every(item => typeof item === 'string') ? (
                     <span>{value.join(', ') || 'N/A'}</span>
                ) : (
                  <span className="text-foreground">{String(value) || 'N/A'}</span>
                )}
              </DataItem>
            ))
          ) : (
            <p className="text-muted-foreground">No checklist answers recorded.</p>
          )}
        </Section>

        {notes && (
          <Section title="General Notes" icon={StickyNote}>
            <p className="whitespace-pre-wrap text-foreground bg-secondary/30 p-3 rounded-md">{notes}</p>
          </Section>
        )}

        {damageSummary && (
          <Section title="AI Damage Assessment" icon={Wand2}>
            <p className="whitespace-pre-wrap text-foreground bg-accent/10 p-3 rounded-md border border-accent/30">{damageSummary}</p>
          </Section>
        )}

        {isReleased !== undefined && (
          <Section title="Vehicle Release Status" icon={isReleased ? CheckSquare : Square}>
            <DataItem label="Status" value={isReleased ? "Released" : "Not Released"} />
            {isReleased && releasedAt && (
              <DataItem label="Released Date" value={new Date(releasedAt).toLocaleString()} />
            )}
            {isReleased && releasedByUserName && (
              <DataItem label="Released By" value={releasedByUserName} />
            )}
             {isReleased && releasedByUserId && (
              <DataItem label="Released By User ID" value={releasedByUserId} />
            )}
          </Section>
        )}

        {displayPhotos && displayPhotos.length > 0 && (
          <Section title="Inspection Photos" icon={Camera}>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 print:grid-cols-2">
              {displayPhotos.map((photo, index) => (
                <div key={index} className="border rounded-md overflow-hidden shadow-sm aspect-video print:aspect-auto print:h-40">
                  <Image
                    src={photo.url} 
                    alt={photo.name || `Inspection Photo ${index + 1}`}
                    width={300}
                    height={200}
                    className="w-full h-full object-cover"
                    data-ai-hint="damaged vehicle"
                  />
                  <p className="text-xs text-center p-1 bg-muted text-muted-foreground print:hidden">{photo.name || `Photo ${index + 1}`}</p>
                </div>
              ))}
            </div>
          </Section>
        )}
        
        <div className="pt-8 mt-8 border-t text-center text-xs text-muted-foreground print:pt-4 print:mt-4 print:border-t-2 print:border-gray-300">
            <p>This report was generated on {new Date().toLocaleString()}.</p>
            <p>&copy; {new Date().getFullYear()} {APP_NAME}. All rights reserved.</p>
        </div>

      </CardContent>
    </Card>
  );
}

