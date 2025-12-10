import 'server-only';
import { ai } from '@/lib/genkit-instance';
import { z } from 'genkit';
import { startProjectTool } from '../tools/project.tools';
import { generatePdfTool } from '../tools/pdf.tools';
import { calculateOfferTool } from '../tools/calculation.tools';
import { analyzeReceiptTool } from '../tools/vision.tools';
import { AI_MODELS, AI_CONFIG } from '../config';

// Simple Message Schema
const MessageSchema = z.object({
    role: z.enum(['user', 'model', 'system']),
    content: z.string(),
});

const ChatInput = z.object({
    messages: z.array(MessageSchema),
    uid: z.string().optional(), // New field for context injection
});

// ... existing schema code ...

// Imports for context
import { UserRepo } from '@/lib/dal/user.repo';
import { CompanyRepo } from '@/lib/dal/company.repo';
import { CustomerRepo } from '@/lib/dal/customer.repo';

import { ProjectRepo } from '@/lib/dal/project.repo';

export const chatFlow = ai.defineFlow(
    {
        name: 'chatFlow',
        inputSchema: ChatInput,
        outputSchema: z.string(),
    },
    async (input) => {
        // Optimize Context: Keep only last N messages to save tokens and prevent context overflow
        const recentMessages = input.messages.slice(-AI_CONFIG.maxHistory);

        // --- CONTEXT INJECTION ---
        let contextContext = "";
        let profileContext = "";
        let customerContext = "";
        let projectContext = "";

        if (input.uid) {
            try {
                const user = await UserRepo.get(input.uid);
                if (user?.companyId) {
                    const company = await CompanyRepo.get(user.companyId);
                    if (company) {
                        // Profile Context
                        if (company.profile) {
                            const p = company.profile;
                            profileContext = `MY COMPANY PROFILE:\nName: ${p.name}\nOrgNr: ${p.orgNumber || 'MISSING'}\nAddress: ${p.address || 'MISSING'}\nPhone: ${p.contactPhone}\nEmail: ${p.contactEmail}\n(Auto-use this for contracts/PDFs)`;
                            if (!p.orgNumber || !p.address) profileContext += "\nWARNING: Company profile is incomplete. Please ask user to update Settings.";
                        }
                        // Preferences Context
                        if (company.context) {
                            contextContext = `MY PREFERENCES & CONTEXT:\n${company.context.preferences}\n\nRISKS/WARNINGS:\n${company.context.risks}\n(Use this to guide advice)`;
                        }

                        // Customer Context
                        const customers = await CustomerRepo.listByCompany(user.companyId);
                        if (customers.length > 0) {
                            customerContext = "CUSTOMER REGISTRY (Known Clients):\n";
                            customers.forEach(c => {
                                const missing = [];
                                if (!c.address) missing.push('Address');
                                if (!c.orgNumber) missing.push('SSN/OrgNr');

                                customerContext += `- ${c.name} [ID: ${c.id}] (${c.type}): ${missing.length > 0 ? `INCOMPLETE (Missing: ${missing.join(', ')})` : 'COMPLETE'}. Info: ${c.address || ''}, ${c.orgNumber || ''}, ${c.email || ''}.\n`;
                            });
                            customerContext += "(Matches to these names should pull this data automatically. Warn if INCOMPLETE but allow user to provide missing info in chat).";
                        }

                        // Project Context (NEW)
                        const projects = await ProjectRepo.listByOwner(input.uid); // Projects are owned by User, not Company in current schema, but functionally same here
                        if (projects.length > 0) {
                            projectContext = "ACTIVE PROJECTS (Use these IDs/Folders for tools):\n";
                            projects.forEach(p => {
                                projectContext += `- ${p.name} [ID: ${p.id}]. Status: ${p.status}. FolderID: ${p.driveFolderId || 'MISSING'}. ${p.address ? `Address: ${p.address}` : ''}\n`;
                            });
                            projectContext += "(When generating PDFs, ALWAYS use the 'driveFolderId' from a matching project if available).";
                        }
                    }
                }
            } catch (e) {
                console.error("Failed to inject context:", e);
            }
        }

        const systemPrompt = `System: You are ByggPilot Co-Pilot, a helpful AI assistant for Swedish construction projects. 
        Current Date: ${new Date().toLocaleDateString('sv-SE')}.
        Role: Act as a senior construction project manager. Be concise, professional, and safety-conscious.
        Language: Answer in Swedish unless asked otherwise.
        
        Capabilities:
        1. PROJECT MANAGEMENT: You can start new projects.
        2. CONTRACTS: You can generate "Hantverkarformuläret 17" contracts for renovation work. Use the 'generatePdf' tool for this. Ask for missing details like Customer Name, Address, Price, and Dates if needed.
        IMPORTANT: Always try to find a matching PROJECT folder to save the PDF to. Use the Project Context below.
        3. CALCULATIONS: You can calculate offers based on recipes.
        4. RECEIPT ANALYSIS: You can analyze receipts for KMA risks.
        
        When the user asks for an agreement/contract ("avtal"), actively propose generating Hantverkarformuläret 17.
        Check the Customer Registry below. If a customer matches, PRE-FILL the data. If data is missing (INCOMPLETE), ask the user for it politely or use it if they provide it in the chat.
        
        ${profileContext}
        
        ${contextContext}

        ${customerContext}

        ${projectContext}`;

        const { text } = await ai.generate({
            prompt: `${systemPrompt}\n\n` + recentMessages.map(m => `${m.role}: ${m.content}`).join('\n'),
            model: AI_MODELS.FAST,
            config: {
                temperature: AI_CONFIG.temperature.creative,
            },
            tools: [startProjectTool, generatePdfTool, calculateOfferTool, analyzeReceiptTool],
        });

        return text;
    }
);


