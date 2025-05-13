// src/actions/inspectionActions.ts
"use server";

import { generateDamageReport } from '@/ai/flows/generate-damage-report.ts';
import type { GenerateDamageReportInput, GenerateDamageReportOutput } from '@/ai/flows/generate-damage-report.ts';

export async function generateAIDamageReportAction(
  input: GenerateDamageReportInput
): Promise<GenerateDamageReportOutput | { error: string }> {
  try {
    // TODO: Add validation and authentication/authorization checks here
    // For example, ensure the user has the correct role.

    const report = await generateDamageReport(input);
    return report;
  } catch (error) {
    console.error("Error generating AI damage report:", error);
    return { error: (error as Error).message || "Failed to generate AI damage report." };
  }
}
