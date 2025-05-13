// src/components/inspection/DamageReportSection.tsx
"use client";

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, AlertTriangle, Wand2 } from 'lucide-react';
import { generateAIDamageReportAction } from '@/actions/inspectionActions';
import type { GenerateDamageReportInput } from '@/ai/flows/generate-damage-report';
import { Label } from '../ui/label';

interface DamageReportSectionProps {
  inspectionNotes: string;
  photoDataUris: string[]; // Expecting array of data URIs
  onReportGenerated: (summary: string) => void;
  initialSummary?: string;
}

export function DamageReportSection({ 
  inspectionNotes, 
  photoDataUris, 
  onReportGenerated,
  initialSummary = ""
}: DamageReportSectionProps) {
  const [summary, setSummary] = useState<string>(initialSummary);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGenerateReport = async () => {
    if (!inspectionNotes && photoDataUris.length === 0) {
      setError("Please provide inspection notes or upload photos to generate a report.");
      return;
    }
    setError(null);
    setIsLoading(true);

    const input: GenerateDamageReportInput = {
      notes: inspectionNotes,
      photoDataUris: photoDataUris,
    };

    try {
      const result = await generateAIDamageReportAction(input);
      if ('error' in result) {
        setError(result.error);
        setSummary("");
      } else {
        setSummary(result.summary);
        onReportGenerated(result.summary);
      }
    } catch (err) {
      setError((err as Error).message || "An unexpected error occurred.");
      setSummary("");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="shadow-md">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Wand2 className="h-6 w-6 text-primary" />
          AI-Powered Damage Report
        </CardTitle>
        <CardDescription>
          Generate a damage summary based on your notes and uploaded photos. Review and edit if necessary.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button
          onClick={handleGenerateReport}
          disabled={isLoading || (!inspectionNotes && photoDataUris.length === 0)}
          className="w-full sm:w-auto bg-accent hover:bg-accent/90 text-accent-foreground"
        >
          {isLoading ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Wand2 className="mr-2 h-4 w-4" />
          )}
          Generate Report
        </Button>

        {error && (
          <div className="flex items-center p-3 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md">
            <AlertTriangle className="h-5 w-5 mr-2 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div>
          <Label htmlFor="damage-summary-textarea" className="block text-sm font-medium text-foreground mb-1">Damage Summary</Label>
          <Textarea
            id="damage-summary-textarea"
            placeholder="AI-generated summary will appear here... Edit as needed."
            value={summary}
            onChange={(e) => {
              setSummary(e.target.value);
              onReportGenerated(e.target.value); // Update parent on manual change
            }}
            rows={8}
            className="bg-background"
          />
        </div>
      </CardContent>
    </Card>
  );
}
