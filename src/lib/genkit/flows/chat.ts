import 'server-only';
import { ai } from '@/lib/genkit-instance';
import { z } from 'genkit';
import { startProjectTool } from '@/lib/genkit/tools/project.tools';
import { updateProjectTool } from '@/lib/genkit/tools/update_project.tool';
import { generatePdfTool, generateOfferTool } from '@/lib/genkit/tools/pdf.tools';
import { calculateOfferTool } from '@/lib/genkit/tools/calculation.tools';
import { repairDriveTool } from '@/lib/genkit/tools/drive.tools';
import { analyzeReceiptTool, analyzeChemicalContainerTool } from '../tools/vision.tools';
import { createChangeOrderTool, draftEmailTool, generateAtaPdfTool } from '@/lib/genkit/tools/ata.tools';
import { checkAvailabilityTool, bookMeetingTool } from '@/lib/genkit/tools/calendar.tools';
import { readEmailTool, sendEmailTool } from '@/lib/genkit/tools/gmail.tools';
import { listOffersTool } from '@/lib/genkit/tools/offer.tools';
import { createCustomerTool, listCustomersTool } from '@/lib/genkit/tools/customer.tools';
import { createDocDraftTool, appendDocTool } from '@/lib/genkit/tools/docs.tools';
import { prepareInvoiceDraftTool, finalizeInvoiceTool } from '@/lib/genkit/tools/invoice.tools';
import { webSearchTool } from '@/lib/genkit/tools/search.tool';
import { createTaskTool, listTasksTool, completeTaskTool } from '@/lib/genkit/tools/tasks.tools';
import { getSystemPrompt } from '@/lib/genkit/prompts/system.prompt'; // Extracted Prompt

import { AI_MODELS, AI_CONFIG } from '../config';
import { defineFlow } from '@genkit-ai/flow';

export const chatFlow = defineFlow(
    {
        name: 'chatFlow',
        inputSchema: z.object({
            messages: z.array(z.any()),
            uid: z.string().optional(),
            accessToken: z.string().optional()
        }),
        outputSchema: z.string(),
        streamSchema: z.string(), // Enable Streaming Support
    },
    async (input, streamingCallback) => {
        const { messages, uid, accessToken } = input;
        const recentMessages = messages.slice(-10); // Context window

        // --- CONTEXT INJECTION ---
        let profileContext = "";
        let contextContext = ""; // For preferences
        let customerContext = "";
        let projectContext = "";

        if (input.uid) {
            try {
                console.log(`🔍 Context Injection started for UID: ${input.uid}`);
                const { UserRepo } = await import('@/lib/dal/user.repo');
                const { CompanyRepo } = await import('@/lib/dal/company.repo');
                const { CustomerRepo } = await import('@/lib/dal/customer.repo');
                const { ProjectRepo } = await import('@/lib/dal/project.repo');

                const user = await UserRepo.get(input.uid);

                if (user?.companyId) {
                    const company = await CompanyRepo.get(user.companyId);
                    if (company) {
                        // Profile
                        if (company.profile) {
                            const p = company.profile;
                            profileContext = `MY COMPANY PROFILE: \nName: ${p.name} \nOrgNr: ${p.orgNumber || 'MISSING'} \nAddress: ${p.address || 'MISSING'} \nPhone: ${p.contactPhone} \nEmail: ${p.contactEmail} \n(Auto - use this for contracts / PDFs)`;
                            if (!p.orgNumber || !p.address) profileContext += "\nWARNING: Company profile is incomplete. Please ask user to update Settings.";
                        }
                        // Preferences
                        if (company.context) {
                            contextContext = `MY PREFERENCES & CONTEXT: \n${company.context.preferences} \n\nRISKS / WARNINGS: \n${company.context.risks} \n(Use this to guide advice)`;
                        }

                        // Customers
                        const customers = await CustomerRepo.listByCompany(user.companyId);
                        if (customers.length > 0) {
                            customerContext = "CUSTOMER REGISTRY (Known Clients):\n";
                            customers.forEach(c => {
                                const missing = [];
                                if (!c.address) missing.push('Address');
                                if (!c.orgNumber) missing.push('SSN/OrgNr');
                                customerContext += `- ${c.name} [ID: ${c.id}](${c.type}): ${missing.length > 0 ? `INCOMPLETE (Missing: ${missing.join(', ')})` : 'COMPLETE'}. Info: ${c.address || ''}, ${c.orgNumber || ''}, Email: ${c.email || 'MISSING'}.\n`;
                            });
                        }

                        // Projects
                        const projects = await ProjectRepo.listByOwner(input.uid);
                        if (projects.length > 0) {
                            projectContext = "ACTIVE PROJECTS (Use these IDs/Folders for tools):\n";
                            projects.forEach(p => {
                                projectContext += `- ${p.name} [ID: ${p.id}]. Status: ${p.status}. FolderID: ${p.driveFolderId || 'MISSING'}. ${p.address ? `Address: ${p.address}` : ''} \n`;
                            });
                        }
                    }
                }
            } catch (e) {
                console.error("❌ Failed to inject context:", e);
            }
        }

        // --- VECTOR SEARCH (RAG) ---
        let knowledgeContext = "";
        const lastUserMsg = messages.slice().reverse().find((m: any) => m.role === 'user');
        const triggerKeywords = ['regler', 'afs', 'bbr', 'lag', 'asbest', 'krav', 'kapitel', 'paragraf', 'teknisk', 'afd', 'föreskrift', 'boverket', 'avtal', 'hantverkarformulär'];

        if (lastUserMsg && triggerKeywords.some(kw => lastUserMsg.content.toLowerCase().includes(kw))) {
            try {
                const { searchKnowledgeBase } = await import('@/lib/dal/vector.store');
                console.log(`🧠 Performing RAG Search for: "${lastUserMsg.content}"`);
                const chunks = await searchKnowledgeBase(lastUserMsg.content, 3);
                if (chunks.length > 0) {
                    knowledgeContext = `\nRELEVANT KNOWLEDGE BASE (Lagboken/Praxis):\n` +
                        chunks.map(c => `[SOURCE: ${c.source}]\n${c.content}\n---`).join('\n');
                }
            } catch (e) {
                console.error("⚠️ Vector Search Failed:", e);
            }
        }

        // --- ASSEMBLE PROMPT ---
        const systemPrompt = getSystemPrompt({
            profileContext,
            customersContext: customerContext,
            projectContext,
            knowledgeContext
        });

        // --- GENERATE ---
        const { text } = await ai.generate({
            prompt: `${systemPrompt} \n\n` + recentMessages.map(m => `${m.role}: ${m.content} `).join('\n'),
            model: process.env.GENKIT_ENV === 'mock' ? AI_MODELS.MOCK : AI_MODELS.FAST,
            config: {
                temperature: AI_CONFIG.temperature.balanced,
            },
            maxTurns: 5, // STOP INFINITE LOOPS
            tools: [
                webSearchTool,
                createTaskTool, listTasksTool, completeTaskTool,
                startProjectTool, updateProjectTool,
                listOffersTool, createCustomerTool, listCustomersTool,
                generatePdfTool, calculateOfferTool,
                analyzeReceiptTool, analyzeChemicalContainerTool,
                repairDriveTool,
                createChangeOrderTool, draftEmailTool, generateAtaPdfTool,
                checkAvailabilityTool, bookMeetingTool,
                readEmailTool, sendEmailTool,
                createDocDraftTool, appendDocTool,
                prepareInvoiceDraftTool, finalizeInvoiceTool
            ],
            context: {
                accessToken: input.accessToken,
                uid: input.uid
            },
            // Note: If 'streamingCallback' is provided by defineFlow, passing it here depends on Genkit version.
            // For now, we return 'text' to be safe, but 'streamSchema' enables the option.
        });

        return text;
    }
);
