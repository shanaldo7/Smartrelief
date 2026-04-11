'use server';
/**
 * @fileOverview An AI assistant that suggests enhancements to task descriptions.
 *
 * - smartTaskDescriptionAssistant - A function that enhances a task description.
 * - SmartTaskDescriptionAssistantInput - The input type for the smartTaskDescriptionAssistant function.
 * - SmartTaskDescriptionAssistantOutput - The return type for the smartTaskDescriptionAssistant function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const SmartTaskDescriptionAssistantInputSchema = z.object({
  taskDescription: z.string().describe('The original task description to be enhanced.'),
});
export type SmartTaskDescriptionAssistantInput = z.infer<typeof SmartTaskDescriptionAssistantInputSchema>;

const SmartTaskDescriptionAssistantOutputSchema = z.object({
  enhancedTaskDescription: z
    .string()
    .describe('The enhanced version of the task description, made clearer, more engaging, and better structured.'),
});
export type SmartTaskDescriptionAssistantOutput = z.infer<typeof SmartTaskDescriptionAssistantOutputSchema>;

export async function smartTaskDescriptionAssistant(
  input: SmartTaskDescriptionAssistantInput
): Promise<SmartTaskDescriptionAssistantOutput> {
  return smartTaskDescriptionAssistantFlow(input);
}

const enhanceTaskDescriptionPrompt = ai.definePrompt({
  name: 'enhanceTaskDescriptionPrompt',
  input: {schema: SmartTaskDescriptionAssistantInputSchema},
  output: {schema: SmartTaskDescriptionAssistantOutputSchema},
  prompt: `You are an AI assistant designed to help organizations and individuals create clear, engaging, and well-structured task descriptions to attract the most suitable volunteers.

Your goal is to take a given task description and enhance it by:
1. Improving clarity: Ensure the task, its purpose, and required actions are easy to understand.
2. Increasing engagement: Use compelling language to motivate potential volunteers.
3. Structuring for volunteers: Suggest breaking down tasks, adding bullet points for responsibilities, specifying necessary skills, time commitment, and benefits for the volunteer.

Provide the enhanced task description. Focus on making it appealing and informative for a volunteer.

Original Task Description:
{{{taskDescription}}}`,
});

const smartTaskDescriptionAssistantFlow = ai.defineFlow(
  {
    name: 'smartTaskDescriptionAssistantFlow',
    inputSchema: SmartTaskDescriptionAssistantInputSchema,
    outputSchema: SmartTaskDescriptionAssistantOutputSchema,
  },
  async input => {
    const {output} = await enhanceTaskDescriptionPrompt(input);
    return output!;
  }
);
