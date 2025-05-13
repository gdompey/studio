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
import type { ChecklistItem, InspectionData } from '@/types';
import { USER_ROLES } from '@/lib/constants';
import { AlertCircle, CheckCircle, Loader2, FileOutput, ListChecks, Car } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';

// Define a more comprehensive schema for the form
const inspectionFormSchema = z.object({
  vin: z.string().min(17, "VIN must be 17 characters").max(17, "VIN must be 17 characters"),
  generalNotes: z.string().optional(),
  // Dynamic checklist fields will be added based on `checklistItems`
  // For now, let's add some example fields to the schema for validation
  exteriorDamage: z.enum(["yes", "no"]).optional(),
  exteriorDamageDescription: z.string().optional(),
  interiorCondition: z.enum(["good", "fair", "poor"]).optional(),
  engineStarts: z.boolean().optional(),
  // This will hold all checklist answers dynamically
  checklistAnswers: z.record(z.any()).default({}),
  damageSummary: z.string().optional(), // From AI report
});

type InspectionFormValues = z.infer<typeof inspectionFormSchema>;

// Example checklist definition
const exampleChecklistItems: ChecklistItem[] = [
  { id: 'vin_confirmation', label: 'VIN Match Vehicle?', type: 'radio', options: ['Yes', 'No'], required: true },
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
    label: 'Exterior Damage Photos', 
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


export function InspectionForm() {
  const { user, role } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [photoDataUris, setPhotoDataUris] = useState<string[]>([]);
  
  const form = useForm<InspectionFormValues>({
    resolver: zodResolver(inspectionFormSchema),
    defaultValues: {
      vin: '',
      generalNotes: '',
      checklistAnswers: {},
      damageSummary: '',
    },
  });

  const { watch, control, setValue } = form;

  // Watch relevant fields for dynamic rendering
  const watchedFields = watch();

  const onSubmit: SubmitHandler<InspectionFormValues> = async (data) => {
    setIsLoading(true);
    if (!user) {
      toast({ title: "Authentication Error", description: "User not found.", variant: "destructive" });
      setIsLoading(false);
      return;
    }

    const inspectionData: InspectionData = {
      id: Date.now().toString(), // Mock ID
      inspectorId: user.id,
      inspectorName: user.name || user.email || "Unknown Inspector",
      vin: data.vin,
      timestamp: new Date().toISOString(),
      photos: photoDataUris.map((uri, index) => ({ name: `photo_${index + 1}.jpg`, url: `mock/path/to/photo_${index + 1}.jpg`, dataUri: uri })), // Mock URL
      notes: data.generalNotes,
      checklistAnswers: data.checklistAnswers,
      damageSummary: data.damageSummary,
    };

    // Simulate saving data
    console.log("Inspection Data to save:", inspectionData);
    await new Promise(resolve => setTimeout(resolve, 1000));

    toast({
      title: "Inspection Saved!",
      description: `Inspection for VIN ${data.vin} has been successfully recorded.`,
      action: (
        <Button variant="outline" size="sm" onClick={() => router.push(`/reports/${inspectionData.id}`)}>
          View Report
        </Button>
      ),
    });
    
    // In a real app, you'd redirect to a view/summary page or dashboard
    // For now, let's imagine a report page:
    localStorage.setItem(`inspection-${inspectionData.id}`, JSON.stringify(inspectionData)); // Save for mock report page
    router.push(`/reports/${inspectionData.id}`);
    
    setIsLoading(false);
  };
  
  const handlePhotosUploaded = (photos: { name: string; dataUri: string }[]) => {
    setPhotoDataUris(photos.map(p => p.dataUri));
    // If a checklist item with type 'photo' exists, you might want to link this.
    // For simplicity, we're keeping it separate for now, but the AI uses `photoDataUris`.
  };

  const handleReportGenerated = (summary: string) => {
    setValue('damageSummary', summary);
  };

  const renderChecklistItem = (item: ChecklistItem) => {
    if (item.roles && role && !item.roles.includes(role)) {
      return null; // Skip rendering if user role doesn't match
    }

    if (item.conditions) {
      const FULFILLED = item.conditions.every(condition => {
        const fieldValue = watchedFields.checklistAnswers?.[condition.field] || watchedFields[condition.field as keyof InspectionFormValues];
        return fieldValue === condition.value;
      });
      if (!FULFILLED) return null;
    }

    const fieldName = `checklistAnswers.${item.id}` as const;

    return (
      <FormItem key={item.id} className="mb-6 p-4 border border-border rounded-md shadow-sm bg-card/50">
        <FormLabel className="text-base font-semibold text-foreground">{item.label} {item.required && <span className="text-destructive">*</span>}</FormLabel>
        <FormControl>
          <>
            {item.type === 'text' && <Input {...form.register(fieldName)} />}
            {item.type === 'textarea' && <Textarea {...form.register(fieldName)} rows={3} />}
            {item.type === 'checkbox' && (
              <div className="flex items-center space-x-2">
                <Checkbox 
                    id={item.id}
                    checked={watchedFields.checklistAnswers?.[item.id] || false}
                    onCheckedChange={(checked) => setValue(fieldName, checked)}
                />
                <label htmlFor={item.id} className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                   {item.label}
                </label>
              </div>
            )}
            {item.type === 'radio' && item.options && (
              <Controller
                name={fieldName}
                control={control}
                render={({ field }) => (
                  <RadioGroup onValueChange={field.onChange} value={field.value} className="flex flex-col space-y-1">
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
              <PhotoUpload onPhotosUploaded={handlePhotosUploaded} />
            )}
          </>
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
            <CardTitle className="text-2xl font-semibold text-primary flex items-center gap-2"><Car className="h-6 w-6"/>Vehicle Information</CardTitle>
            <CardDescription>Enter the basic details for the vehicle being inspected.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <FormField
              control={form.control}
              name="vin"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Vehicle Identification Number (VIN)</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter 17-character VIN" {...field} className="uppercase" />
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
            <CardTitle className="text-2xl font-semibold text-primary">General Notes & Photos</CardTitle>
            <CardDescription>Add any overall notes and upload relevant photos for the inspection.</CardDescription>
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
            <PhotoUpload onPhotosUploaded={handlePhotosUploaded} maxFiles={10} />
          </CardContent>
        </Card>

        {(watchedFields.checklistAnswers?.['exterior_damage_present'] === 'Yes' || photoDataUris.length > 0) && (
            <DamageReportSection
                inspectionNotes={watchedFields.checklistAnswers?.['exterior_damage_details'] || watchedFields.generalNotes || ""}
                photoDataUris={photoDataUris}
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
                    <CheckCircle className="mr-2 h-4 w-4" />
                )}
                Save Inspection
            </Button>
        </div>

        {Object.keys(form.formState.errors).length > 0 && (
          <div className="mt-6 p-4 border border-destructive/50 bg-destructive/10 rounded-md text-destructive">
            <div className="flex items-center font-semibold mb-2">
              <AlertCircle className="h-5 w-5 mr-2" />
              Please correct the errors above.
            </div>
            <ul className="list-disc list-inside text-sm">
              {Object.entries(form.formState.errors).map(([key, error]) => (
                <li key={key}>{String(error?.message || `Error in ${key}`)}</li>
              ))}
            </ul>
          </div>
        )}
      </form>
    </Form>
  );
}
