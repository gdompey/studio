// src/components/inspection/InspectionForm.tsx
"use client";

import React, { useState, useEffect } from 'react';
import { useForm, Controller, type SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PhotoUpload } from './PhotoUpload';
import { DamageReportSection } from './DamageReportSection';
import { useAuth } from '@/hooks/useAuth';
import type { ChecklistItem, InspectionData, InspectionPhoto as ClientInspectionPhoto } from '@/types';
import { USER_ROLES } from '@/lib/constants';
import { AlertCircle, CheckCircle, Loader2, FileOutput, ListChecks, Car, Truck, StickyNote, Fuel, UserCircle, Building, Users, Briefcase, Camera, Save } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { firestore, storage } from '@/lib/firebase/config';
import { addDoc, collection, doc, setDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { saveInspectionOffline, type LocalInspectionData } from '@/lib/indexedDB'; // Import LocalInspectionData type

// Define a more comprehensive schema for the form
const inspectionFormSchema = z.object({
  truckIdNo: z.string().min(1, "Truck ID No. is required"),
  truckRegNo: z.string().min(1, "Truck Reg No. is required"),
  generalNotes: z.string().optional(),
  checklistAnswers: z.record(z.any()).default({}),
  damageSummary: z.string().optional(),
});

type InspectionFormValues = z.infer<typeof inspectionFormSchema>;

const exampleChecklistItems: ChecklistItem[] = [
  { id: 'vin_confirmation', label: 'Truck ID No. Match Vehicle?', type: 'radio', options: ['Yes', 'No'], required: true },
  { id: 'driver_name', label: 'Driver Name', type: 'text', required: true },
  { id: 'company_name', label: 'Company Name', type: 'text', required: false },
  { id: 'transporter_name', label: 'Transporter Name', type: 'text', required: false },
  { id: 'business_unit', label: 'Business Unit', type: 'select', options: ['Logistics', 'Retail', 'Manufacturing', 'Other'], required: false },
  { id: 'fuel_quantity', label: 'Fuel Quantity', type: 'select', options: ['Empty', 'Reserve', '1/4 Tank', '1/2 Tank', '3/4 Tank', 'Full Tank'], required: true },
  { id: 'accessories_present', label: 'Accessories Present (e.g., spare tire, jack, toolkit)', type: 'textarea', required: false },
  { id: 'exterior_damage_present', label: 'Exterior Damage Present?', type: 'radio', options: ['Yes', 'No'], required: true },
  { 
    id: 'exterior_damage_details', 
    label: 'Describe Exterior Damage', 
    type: 'textarea', 
    dependencies: ['exterior_damage_present'],
    conditions: [{field: 'exterior_damage_present', value: 'Yes'}],
    required: true 
  },
  { 
    id: 'exterior_photos', 
    label: 'Exterior Damage Photos (Additional)', 
    type: 'photo', 
    dependencies: ['exterior_damage_present'],
    conditions: [{field: 'exterior_damage_present', value: 'Yes'}],
  },
  { id: 'interior_condition_rating', label: 'Interior Condition', type: 'select', options: ['Excellent', 'Good', 'Fair', 'Poor'], required: true },
  { id: 'engine_starts_check', label: 'Engine Starts and Runs Smoothly?', type: 'checkbox' },
  { 
    id: 'admin_valuation_notes', 
    label: 'Admin Valuation Notes (Admin Only)', 
    type: 'textarea', 
    roles: [USER_ROLES.ADMIN] 
  },
];

interface InspectionFormProps {
  initialPhotos?: ClientInspectionPhoto[];
  initialLocation?: { latitude: number; longitude: number } | null;
}

function dataURIToBlob(dataURI: string): Blob {
  const byteString = atob(dataURI.split(',')[1]);
  const mimeString = dataURI.split(',')[0].split(':')[1].split(';')[0];
  const ab = new ArrayBuffer(byteString.length);
  const ia = new Uint8Array(ab);
  for (let i = 0; i < byteString.length; i++) {
    ia[i] = byteString.charCodeAt(i);
  }
  return new Blob([ab], { type: mimeString });
}


export function InspectionForm({ initialPhotos = [], initialLocation = null }: InspectionFormProps) {
  const { user, role } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const isOnline = useOnlineStatus();
  
  const [photoDataUrisForAI, setPhotoDataUrisForAI] = useState<string[]>(initialPhotos.filter(p=>p.dataUri).map(p => p.dataUri!));
  const [allClientPhotos, setAllClientPhotos] = useState<ClientInspectionPhoto[]>(initialPhotos);


  const form = useForm<InspectionFormValues>({
    resolver: zodResolver(inspectionFormSchema),
    defaultValues: {
      truckIdNo: '',
      truckRegNo: '',
      generalNotes: '',
      checklistAnswers: {},
      damageSummary: '',
    },
  });

  const { watch, control, setValue, register: formRegister, formState } = form;
  const watchedFields = watch();

  useEffect(() => {
    setAllClientPhotos(initialPhotos);
    setPhotoDataUrisForAI(initialPhotos.filter(p=>p.dataUri).map(p => p.dataUri!));
  }, [initialPhotos]);


  const onSubmit: SubmitHandler<InspectionFormValues> = async (data) => {
    setIsLoading(true);
    if (!user) {
      toast({ title: "Authentication Error", description: "User not found.", variant: "destructive" });
      setIsLoading(false);
      return;
    }

    const localId = `offline_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    // Prepare data for both online and offline saving
    const inspectionBaseData = {
        localId, // Used as key in IndexedDB and can be stored in Firestore for reconciliation
        inspectorId: user.id,
        inspectorName: user.name || user.email || "Unknown Inspector",
        truckIdNo: data.truckIdNo.toUpperCase(),
        truckRegNo: data.truckRegNo.toUpperCase(),
        timestamp: new Date().toISOString(),
        notes: data.generalNotes,
        checklistAnswers: data.checklistAnswers,
        damageSummary: data.damageSummary,
        latitude: initialLocation?.latitude,
        longitude: initialLocation?.longitude,
    };

    if (isOnline) {
      try {
        const uploadedPhotoMetadatas: Array<{ name: string; url: string }> = [];
        for (const clientPhoto of allClientPhotos) {
          if (clientPhoto.dataUri && !clientPhoto.url.startsWith('https://firebasestorage.googleapis.com')) {
            const photoBlob = dataURIToBlob(clientPhoto.dataUri);
            const photoName = clientPhoto.name || `photo_${Date.now()}`;
            // Use localId for path predictability before Firestore doc is created
            const photoRef = ref(storage, `inspections/${localId}/${photoName}`);
            await uploadBytes(photoRef, photoBlob);
            const downloadURL = await getDownloadURL(photoRef);
            uploadedPhotoMetadatas.push({ name: photoName, url: downloadURL });
          } else if (clientPhoto.url.startsWith('https://firebasestorage.googleapis.com')) {
             uploadedPhotoMetadatas.push({ name: clientPhoto.name, url: clientPhoto.url });
          }
        }
        
        const inspectionDataToSaveOnline: Omit<InspectionData, 'id'> = {
          ...inspectionBaseData,
          photos: uploadedPhotoMetadatas,
        };

        const docRef = await addDoc(collection(firestore, "inspections"), inspectionDataToSaveOnline);
        
        toast({
          title: "Inspection Saved Online!",
          description: `Inspection for Truck ID ${data.truckIdNo} recorded in Firebase.`,
          action: <Button variant="outline" size="sm" onClick={() => router.push(`/reports/${docRef.id}`)}>View Report</Button>,
        });
        router.push(`/reports/${docRef.id}`);

      } catch (error) {
        console.error("Error saving inspection online, attempting offline save:", error);
        toast({
          title: "Online Save Failed",
          description: "Could not save to Firebase. Saving offline instead.",
          variant: "destructive",
        });
        await saveToOfflineDB(data, localId);
      }
    } else {
      // Offline saving
      await saveToOfflineDB(data, localId);
    }
    setIsLoading(false);
  };

  const saveToOfflineDB = async (data: InspectionFormValues, localIdToUse: string) => {
     const inspectionDataToSaveOffline: LocalInspectionData = {
        localId: localIdToUse,
        inspectorId: user!.id, // user is checked before onSubmit
        inspectorName: user!.name || user!.email || "Unknown Inspector",
        truckIdNo: data.truckIdNo.toUpperCase(),
        truckRegNo: data.truckRegNo.toUpperCase(),
        timestamp: new Date().toISOString(),
        // Store photos with dataUris for offline
        photos: allClientPhotos.map(p => ({ name: p.name, url: p.url, dataUri: p.dataUri })),
        notes: data.generalNotes,
        checklistAnswers: data.checklistAnswers,
        damageSummary: data.damageSummary,
        latitude: initialLocation?.latitude,
        longitude: initialLocation?.longitude,
        needsSync: true,
      };

      try {
        await saveInspectionOffline(inspectionDataToSaveOffline);
        toast({
          title: "Inspection Saved Offline",
          description: `Truck ID ${data.truckIdNo} saved locally. Will sync when online.`,
        });
        router.push('/inspections'); // Navigate to list page, which should show offline items
      } catch (offlineError) {
        console.error("Error saving inspection offline:", offlineError);
        toast({
          title: "Offline Save Failed",
          description: "Could not save inspection locally.",
          variant: "destructive",
        });
      }
  };
  
  const handleFormPhotosUploaded = (newlyUploadedPhotos: { name: string; dataUri: string }[], formItemId?: string) => {
    const clientPhotos: ClientInspectionPhoto[] = newlyUploadedPhotos.map(p => ({...p, url: '' }));

    if (formItemId) {
      // Store just dataUris or a reference in checklistAnswers if type is 'photo'
      const currentChecklistPhotos = (form.getValues(`checklistAnswers.${formItemId}`) as string[] || []);
      setValue(`checklistAnswers.${formItemId}` as const, [...currentChecklistPhotos, ...clientPhotos.map(p => p.dataUri!)]);
      // Add to allClientPhotos for global tracking and AI
      setAllClientPhotos(prev => [...prev.filter(ex => !clientPhotos.some(np => np.dataUri === ex.dataUri)), ...clientPhotos]);
      setPhotoDataUrisForAI(prev => [...new Set([...prev, ...clientPhotos.map(p => p.dataUri!)])]);

    } else { 
      // General photos
      setAllClientPhotos(prev => [...prev.filter(ex => !clientPhotos.some(np => np.dataUri === ex.dataUri)), ...clientPhotos]);
      setPhotoDataUrisForAI(prev => [...new Set([...prev, ...clientPhotos.map(p => p.dataUri!)])]);
    }
  };


  const handleReportGenerated = (summary: string) => {
    setValue('damageSummary', summary);
  };

  const getChecklistItemIcon = (itemId: string) => {
    if (itemId.includes('fuel')) return <Fuel className="inline-block mr-2 h-5 w-5 text-muted-foreground" />;
    if (itemId.includes('driver')) return <UserCircle className="inline-block mr-2 h-5 w-5 text-muted-foreground" />;
    if (itemId.includes('company')) return <Building className="inline-block mr-2 h-5 w-5 text-muted-foreground" />;
    if (itemId.includes('transporter')) return <Users className="inline-block mr-2 h-5 w-5 text-muted-foreground" />;
    if (itemId.includes('business')) return <Briefcase className="inline-block mr-2 h-5 w-5 text-muted-foreground" />;
    if (itemId.includes('accessories')) return <StickyNote className="inline-block mr-2 h-5 w-5 text-muted-foreground" />;
    if (itemId.includes('photo')) return <Camera className="inline-block mr-2 h-5 w-5 text-muted-foreground" />;
    return null;
  }

  const renderChecklistItem = (item: ChecklistItem) => {
    if (item.roles && role && !item.roles.includes(role)) {
      return null;
    }

    if (item.conditions) {
      const FULFILLED = item.conditions.every(condition => {
        const fieldValue = watchedFields.checklistAnswers?.[condition.field] || watchedFields[condition.field as keyof InspectionFormValues];
        if (typeof fieldValue === 'boolean' && typeof condition.value === 'string') {
            return (fieldValue ? 'Yes' : 'No') === condition.value;
        }
        return fieldValue === condition.value;
      });
      if (!FULFILLED) return null;
    }

    const fieldName = `checklistAnswers.${item.id}` as const;
    const Icon = getChecklistItemIcon(item.id);

    return (
      <FormItem key={item.id} className="mb-6 p-4 border border-border rounded-md shadow-sm bg-card/50">
        <FormLabel className="text-base font-semibold text-foreground flex items-center">
          {Icon}
          {item.label} {item.required && <span className="text-destructive ml-1">*</span>}
        </FormLabel>
        <FormControl>
          <div> {/* Ensure FormControl has a single direct child that can accept props */}
            {item.type === 'text' && <Input {...formRegister(fieldName)} />}
            {item.type === 'textarea' && <Textarea {...formRegister(fieldName)} rows={3} />}
            {item.type === 'checkbox' && (
              <div className="flex items-center space-x-2 pt-2">
                <Controller
                  name={fieldName}
                  control={control}
                  render={({ field }) => (
                    <Checkbox
                      id={item.id} // id for label association
                      checked={field.value || false}
                      onCheckedChange={field.onChange}
                    />
                  )}
                />
                <label htmlFor={item.id} className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                   Confirm
                </label>
              </div>
            )}
            {item.type === 'radio' && item.options && (
              <Controller
                name={fieldName}
                control={control}
                rules={{ required: item.required ? `${item.label} is required` : false }}
                render={({ field }) => (
                  <RadioGroup onValueChange={field.onChange} value={field.value} className="flex flex-col space-y-1 pt-2">
                    {item.options?.map(opt => (
                      <FormItem key={opt} className="flex items-center space-x-3 space-y-0">
                        <FormControl>
                          <RadioGroupItem value={opt} />
                        </FormControl>
                        <FormLabel className="font-normal">{opt}</FormLabel>
                      </FormItem>
                    ))}
                  </RadioGroup>
                )}
              />
            )}
            {item.type === 'select' && item.options && (
               <Controller
                name={fieldName}
                control={control}
                rules={{ required: item.required ? `${item.label} is required` : false }}
                render={({ field }) => (
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <SelectTrigger>
                      <SelectValue placeholder={`Select ${item.label.toLowerCase()}`} />
                    </SelectTrigger>
                    <SelectContent>
                      {item.options?.map(opt => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}
                    </SelectContent>
                  </Select>
                )}
              />
            )}
            {item.type === 'photo' && (
              // This PhotoUpload is specific to a checklist item.
              // It should update checklistAnswers[item.id] with photo data (e.g., dataUris or references)
              // And also contribute to the global allClientPhotos for AI and main storage.
              <PhotoUpload 
                onPhotosUploaded={(photos) => handleFormPhotosUploaded(photos, item.id)} 
                maxFiles={2} // Example: limit photos per checklist item
              />
            )}
          </div>
        </FormControl>
        <FormMessage>{form.formState.errors.checklistAnswers?.[item.id]?.message as React.ReactNode}</FormMessage>
      </FormItem>
    );
  };


  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="text-2xl font-semibold text-primary flex items-center gap-2"><Truck className="h-6 w-6"/>Truck Information</CardTitle>
            <CardDescription>Enter the basic details for the truck being inspected.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <FormField
              control={form.control}
              name="truckIdNo"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Truck ID No.</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter Truck ID No." {...field} className="uppercase" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="truckRegNo"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Truck Registration No.</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter Truck Registration No." {...field} className="uppercase" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="text-2xl font-semibold text-primary flex items-center gap-2"><ListChecks className="h-6 w-6"/>Inspection Checklist</CardTitle>
            <CardDescription>Complete the checklist below. Fields may appear based on your selections.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {exampleChecklistItems.map(renderChecklistItem)}
          </CardContent>
        </Card>
        
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="text-2xl font-semibold text-primary flex items-center gap-2"><Camera className="h-6 w-6" /> General Notes & Additional Photos</CardTitle>
            <CardDescription>Add any overall notes and upload more general photos for the inspection (not tied to a specific damage). These will be used by the AI report. Initial photos are already included.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <FormField
              control={form.control}
              name="generalNotes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>General Inspection Notes</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Enter any overall observations, specific damages, or comments..." {...field} rows={5} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            {/* This PhotoUpload is for general photos, not tied to a checklist item. */}
            <PhotoUpload onPhotosUploaded={(photos) => handleFormPhotosUploaded(photos)} maxFiles={10} />
          </CardContent>
        </Card>

        {(watchedFields.checklistAnswers?.['exterior_damage_present'] === 'Yes' || photoDataUrisForAI.length > 0) && (
            <DamageReportSection
                inspectionNotes={watchedFields.checklistAnswers?.['exterior_damage_details'] || watchedFields.generalNotes || ""}
                photoDataUris={photoDataUrisForAI} 
                onReportGenerated={handleReportGenerated}
                initialSummary={watchedFields.damageSummary}
            />
        )}

        <div className="flex justify-end space-x-4 pt-8">
            <Button type="button" variant="outline" onClick={() => router.back()} disabled={isLoading}>
                Cancel
            </Button>
            <Button type="submit" className="bg-primary hover:bg-primary/90" disabled={isLoading}>
                {isLoading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                    <Save className="mr-2 h-4 w-4" />
                )}
                {isOnline ? 'Save Inspection' : 'Save Offline'}
            </Button>
        </div>

        {Object.keys(formState.errors).length > 0 && (
          <div className="mt-6 p-4 border border-destructive/50 bg-destructive/10 rounded-md text-destructive">
            <div className="flex items-center font-semibold mb-2">
              <AlertCircle className="h-5 w-5 mr-2" />
              Please correct the errors above.
            </div>
            <ul className="list-disc list-inside text-sm">
              {Object.entries(formState.errors).map(([key, error]) => (
                 <li key={key}>
                  {key === 'checklistAnswers' && error && typeof error === 'object' && error.message === undefined // Check if it's nested checklist errors
                    ? Object.entries(error as Record<string, any>).map(([itemKey, itemError]) => (
                        itemError?.message ? `${itemKey.replace(/_/g, ' ')}: ${itemError.message}` : null
                      )).filter(Boolean).join('; ')
                    : String(error?.message || `Error in ${key}`)}
                </li>
              ))}
            </ul>
          </div>
        )}
      </form>
    </Form>
  );
}
