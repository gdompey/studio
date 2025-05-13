'use server';

/**
 * @fileOverview Generates a summary damage report from notes and photos provided by an inspector.
 *
 * - generateDamageReport - A function that handles the generation of the damage report.
 * - GenerateDamageReportInput - The input type for the generateDamageReport function.
 * - GenerateDamageReportOutput - The return type for the generateDamageReport function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const GenerateDamageReportInputSchema = z.object({
  notes: z.string().describe('Inspector notes on the vehicle damage.'),
  photoDataUris: z
    .array(z.string())
    .describe(
      'Photos of the vehicle damage, as data URIs that must include a MIME type and use Base64 encoding. Expected format: \'data:<mimetype>;base64,<encoded_data>\'.' // Corrected typo here
    ),
});
export type GenerateDamageReportInput = z.infer<typeof GenerateDamageReportInputSchema>;

const GenerateDamageReportOutputSchema = z.object({
  summary: z.string().describe('A summary of the damage to the vehicle.'),
});
export type GenerateDamageReportOutput = z.infer<typeof GenerateDamageReportOutputSchema>;

export async function generateDamageReport(input: GenerateDamageReportInput): Promise<GenerateDamageReportOutput> {
  return generateDamageReportFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateDamageReportPrompt',
  input: {schema: GenerateDamageReportInputSchema},
  output: {schema: GenerateDamageReportOutputSchema},
  prompt: `You are an expert damage assessor. Based on the following notes and images, create a summary of the damage to the vehicle.

Notes: {{{notes}}}

{{#each photoDataUris}}
Photo {{@index}}: {{media url=this}}
{{/each}}`,
});

const generateDamageReportFlow = ai.defineFlow(
  {
    name: 'generateDamageReportFlow',
    inputSchema: GenerateDamageReportInputSchema,
    outputSchema: GenerateDamageReportOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
