'use server';

import { ai } from '@/lib/genkit';
import { AI_MODELS } from '@/lib/genkit/config';
import { runFlow } from '@genkit-ai/flow';
import { chatFlow } from '@/lib/genkit/flows/chat';
import { offerFlow } from '@/lib/genkit/flows/offer';
import { emailAnalysisFlow } from '@/lib/genkit/flows/email-analysis';
import { ProjectRepo } from '@/lib/dal/project.repo';
import { OfferRepo } from '@/lib/dal/offer.repo';
import { GmailService } from '@/lib/google/gmail';
import { CalendarService } from '@/lib/google/calendar';
import { db } from '@/lib/dal/server';
import { CompanyRepo } from '@/lib/dal/company.repo';
import { UserRepo } from '@/lib/dal/user.repo';
import { getAuthenticatedUser, checkOwnership } from '@/lib/auth';

import { syncChecklistAction, getTasksAction } from '@/app/actions/tasks';
export { syncChecklistAction, getTasksAction };


// --- AI GENERATION ---
export async function generateTextAction(prompt: string) {
  try {
    await getAuthenticatedUser();
    const { text } = await ai.generate({
      model: AI_MODELS.FAST,
      prompt: prompt,
      config: { temperature: 0.7 },
    });
    return { success: true, text };
  } catch (error: any) {
    console.error("Genkit Error:", error);
    return { success: false, error: error.message };
  }
}

// --- GOOGLE DRIVE ---
export async function createCompanyDriveFolderAction(accessToken: string, companyName: string): Promise<{ success: boolean; folderId?: string; error?: string }> {
  try {
    await getAuthenticatedUser(); // Verify session exists

    // 1. Create Root Folder
    const rootMetadata = {
      name: `ByggPilot - ${companyName}`,
      mimeType: 'application/vnd.google-apps.folder',
    };

    console.log("📂 Server Action: Creating Root Drive folder...");
    const rootRes = await fetch('https://www.googleapis.com/drive/v3/files', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(rootMetadata),
    });

    if (!rootRes.ok) {
      const errorData = await rootRes.json();
      console.error("❌ Drive Root Error:", errorData);
      return { success: false, error: JSON.stringify(errorData) };
    }
    const rootFile = await rootRes.json();
    const rootId = rootFile.id;
    console.log("✅ Root Folder Created:", rootId);

    // 2. Create Subfolders
    const subfolders = ['Kunder', 'Projekt', 'Dokumentation', 'Offerter'];

    await Promise.all(subfolders.map(async (name) => {
      const folderMetadata = {
        name: name,
        mimeType: 'application/vnd.google-apps.folder',
        parents: [rootId]
      };
      await fetch('https://www.googleapis.com/drive/v3/files', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(folderMetadata),
      });
    }));

    console.log("✅ Subfolders Created");
    return { success: true, folderId: rootId };
  } catch (error: any) {
    console.error("❌ Server Action Failed (Exception):", error);
    return { success: false, error: error.message };
  }
}

// --- CHAT ---
// REMOVED unsafe args (uid). Now derives user from session.
export async function chatAction(messages: any[], accessToken?: string) {
  try {
    const user = await getAuthenticatedUser();
    console.log('💬 Chat Action Triggered for user', user.uid);

    // 1. Persistence Setup
    const { ChatRepo } = await import('@/lib/dal/chat.repo');
    const session = await ChatRepo.getOrCreateActiveSession(user.uid);
    const sessionId = session.id;

    // 2. Add Newest User Message (The last one in the Client array)
    const lastMsg = messages[messages.length - 1];
    if (lastMsg && lastMsg.role === 'user') {
      await ChatRepo.addMessage(session.id, 'user', lastMsg.content);
    }

    // 3. Load DB History for Context (Limit ~20 for AI speed)
    const dbMsgs = await ChatRepo.getHistory(session.id, 20);
    const history = dbMsgs.map(m => ({ role: m.role, content: m.content }));

    // 4. Run AI
    const response = await runFlow(chatFlow, { messages: history, uid: user.uid, accessToken });

    // 5. Save AI Response
    await ChatRepo.addMessage(sessionId, 'model', response);

    return { success: true, text: response, sessionId };
  } catch (error: any) {
    console.error('❌ Chat Action Failed:', error);
    return { success: false, error: error.message || 'Unknown error' };
  }
}

export async function loadChatHistoryAction() {
  try {
    const user = await getAuthenticatedUser();
    const { ChatRepo } = await import('@/lib/dal/chat.repo');
    const session = await ChatRepo.getOrCreateActiveSession(user.uid);
    const msgs = await ChatRepo.getHistory(session.id, 50); // initial load limit

    // Map to UI format
    const uiMsgs = msgs.map(m => ({
      role: m.role,
      content: m.content,
      draft: m.draft
    }));

    return { success: true, messages: uiMsgs, sessionId: session.id };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

export async function resetChatAction() {
  try {
    const user = await getAuthenticatedUser();
    const { ChatRepo } = await import('@/lib/dal/chat.repo');
    await ChatRepo.archiveActiveSession(user.uid);
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

// --- PROJECTS ---
// Removed ownerId from input.
export async function createProjectAction(data: { name: string; address?: string; customerName?: string; customerId?: string; description?: string; accessToken?: string }) {
  // Helper: Find Folder
  const findDriveFolder = async (token: string, name: string, parentId: string = 'root') => {
    const q = `mimeType='application/vnd.google-apps.folder' and name='${name}' and '${parentId}' in parents and trashed=false`;
    const res = await fetch(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id,name)`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const d = await res.json();
    return d.files?.[0]?.id;
  };

  // Helper: Create Folder
  const createDriveFolder = async (token: string, name: string, parentId: string = 'root') => {
    const res = await fetch('https://www.googleapis.com/drive/v3/files', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, mimeType: 'application/vnd.google-apps.folder', parents: [parentId] })
    });
    const d = await res.json();
    return d.id;
  };

  try {
    const user = await getAuthenticatedUser();
    const ownerId = user.uid;
    console.log('🏗️ Create Project Action:', data.name);

    let driveFolderId = undefined;

    // 0. Get Project Number
    let projectNumber: string | undefined;
    try {
      const dbUser = await UserRepo.get(ownerId);
      if (dbUser?.companyId) {
        projectNumber = await CompanyRepo.getNextProjectNumber(dbUser.companyId);
        console.log(`🔢 Assigned Project Number: ${projectNumber}`);
      }
    } catch (e) {
      console.warn("Failed to assign project number", e);
    }

    const driveFolderName = projectNumber ? `${projectNumber} - ${data.name}` : data.name;

    // Robust Drive Creation Logic (Existing, updated to use driveFolderName)
    if (data.accessToken) {
      try {
        console.log("📂 Initiating Drive Folder Creation...");
        const dbUser = await UserRepo.get(ownerId);
        if (dbUser?.companyId) {
          const company = await CompanyRepo.get(dbUser.companyId);
          if (company) {
            const rootName = `ByggPilot - ${company.name}`;
            let rootId = await findDriveFolder(data.accessToken, rootName);

            if (!rootId) {
              console.log("root folder not found, creating:", rootName);
              rootId = await createDriveFolder(data.accessToken, rootName);
            }

            if (rootId) {
              let projectsId = await findDriveFolder(data.accessToken, '02_Pågående Projekt', rootId); // Corrected to ISO name
              if (!projectsId) {
                // Fallback for manual creation or legacy 'Projekt'
                projectsId = await findDriveFolder(data.accessToken, 'Projekt', rootId);
                if (!projectsId) {
                  projectsId = await createDriveFolder(data.accessToken, '02_Pågående Projekt', rootId);
                }
              }

              if (projectsId) {
                driveFolderId = await createDriveFolder(data.accessToken, driveFolderName, projectsId);
                console.log("✅ Project Folder Created:", driveFolderId);
              }
            }
          }
        }
      } catch (e) {
        console.error("⚠️ Drive Creation Failed (Non-blocking):", e);
      }
    }

    const project = await ProjectRepo.create({
      ownerId: ownerId,
      name: data.name,
      address: data.address,
      customerName: data.customerName,
      customerId: data.customerId,
      description: data.description,
      status: 'active',
      driveFolderId,
      projectNumber
    });

    // --- PHASE 7: THE PUTTER (RISK ENGINE) ---
    try {
      const { RiskEngine } = await import('@/lib/logic/risk-engine');
      await RiskEngine.scanProject(project.id, data.description || '', data.name);
    } catch (e) {
      console.error("⚠️ Risk Engine Failed:", e);
      // Non-blocking
    }
    // -----------------------------------------

    // Convert Firestore Timestamps/Dates to plain strings for Client Component compatibility
    const plainProject = {
      ...project,
      createdAt: project.createdAt instanceof Date ? project.createdAt.toISOString() :
        (project.createdAt?.toDate ? project.createdAt.toDate().toISOString() : new Date().toISOString()),
    };

    return { success: true, project: plainProject };
  } catch (error: any) {
    console.error('❌ Create Project Failed:', error);
    return { success: false, error: error.message };
  }
}

// --- ECONOMY OPTIMIZATION HELPER ---
async function recalculateProjectEconomy(projectId: string) {
  try {
    console.log(`💰 Recalculating Economy for ${projectId}...`);
    const { OfferRepo } = await import('@/lib/dal/offer.repo');
    const { ChangeOrderRepo } = await import('@/lib/dal/ata.repo');

    const [offers, atas] = await Promise.all([
      OfferRepo.listByProject(projectId),
      ChangeOrderRepo.listByProject(projectId)
    ]);

    const offerTotal = offers
      .filter(o => o.status === 'accepted')
      .reduce((sum, o) => sum + o.totalAmount, 0);

    const ataTotal = atas
      .filter(a => a.status === 'approved')
      .reduce((sum, a) => sum + a.estimatedCost, 0);

    const economy = {
      offerTotal,
      ataTotal,
      totalValue: offerTotal + ataTotal,
      updatedAt: new Date().toISOString()
    };

    await ProjectRepo.update(projectId, { economy });
    console.log(`✅ Economy Updated: ${economy.totalValue} kr`);
  } catch (e) {
    console.error("Economy Recalculation Failed:", e);
  }
}

export async function getProjectsAction() {
  try {
    const user = await getAuthenticatedUser();
    const projects = await ProjectRepo.listByOwner(user.uid, 50);

    const enrichedProjects = await Promise.all(projects.map(async (p) => {
      // LAZY MIGRATION: If economy is missing, trigger async calc
      if (!p.economy) {
        recalculateProjectEconomy(p.id).catch(console.error);
      }

      const economy = p.economy || { offerTotal: 0, ataTotal: 0, totalValue: 0, updatedAt: new Date().toISOString() };

      // Sanitize: Exclude original timestamps, convert to string
      const { createdAt, updatedAt, ...rest } = p as any;

      return {
        ...rest,
        id: p.id,
        createdAt: p.createdAt instanceof Date ? p.createdAt.toISOString() : (p.createdAt?.toDate ? p.createdAt.toDate().toISOString() : new Date().toISOString()),
        updatedAt: updatedAt instanceof Date ? updatedAt.toISOString() : (updatedAt?.toDate ? updatedAt.toDate().toISOString() : undefined),
        economy
      };
    }));

    return { success: true, projects: enrichedProjects };
  } catch (error: any) {
    console.error('❌ Get Projects Failed:', error);
    return { success: false, error: error.message };
  }
}

export async function getProjectAction(projectId: string) {
  try {
    const user = await getAuthenticatedUser();
    // SECURE: Check Ownership
    const project = await checkOwnership(projectId, 'projects', user) as any;

    return {
      success: true,
      project: {
        ...project,
        createdAt: project.createdAt.toDate().toISOString()
      }
    };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

// Helper to get Google Drive Service imported dynamically (server-only constraint)
const getDriveService = async () => {
  const { GoogleDriveService } = await import('@/lib/google/drive');
  return GoogleDriveService;
};

export async function updateProjectAction(projectId: string, data: Partial<any>) {
  try {
    const user = await getAuthenticatedUser();
    const existingProject = await checkOwnership(projectId, 'projects', user) as any;

    // 1. Update Firestore
    await ProjectRepo.update(projectId, data);

    // 2. Check if name or projectNumber changed, and if we need to rename Drive folder
    const newName = data.name || existingProject.name;
    const newNumber = data.projectNumber !== undefined ? data.projectNumber : existingProject.projectNumber;

    // Only rename if something relevant changed AND we have a driveFolderId
    if (existingProject.driveFolderId && (data.name || data.projectNumber)) {
      const folderName = newNumber ? `${newNumber} - ${newName}` : newName;
      console.log(`📂 Renaming Drive Folder to: ${folderName}`);

      try {
        const drive = await getDriveService();
        await drive.renameFolder(existingProject.driveFolderId, folderName);
        console.log("✅ Drive Folder Renamed");
      } catch (e) {
        console.error("⚠️ Failed to rename Drive folder:", e);
        // Non-blocking error
      }
    }

    // --- PHASE 7: THE PUTTER (RISK ENGINE) ---
    // If description or name changed, re-scan
    if (data.description || data.name) {
      try {
        const { RiskEngine } = await import('@/lib/logic/risk-engine');
        await RiskEngine.scanProject(projectId, data.description || existingProject.description || '', data.name || existingProject.name);
      } catch (e) {
        console.error("⚠️ Risk Engine Failed (Update):", e);
      }
    }
    // -----------------------------------------

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function deleteProjectAction(projectId: string) {
  try {
    const user = await getAuthenticatedUser();
    await checkOwnership(projectId, 'projects', user);
    await ProjectRepo.delete(projectId);
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

// --- OFFERS ---
export async function generateOfferAction(projectTitle: string, notes: string) {
  try {
    await getAuthenticatedUser(); // Just auth check
    console.log('🤖 AI Generating Offer...');
    const result = await offerFlow({ projectTitle, notes });
    return { success: true, data: result };
  } catch (error: any) {
    console.error('❌ AI Offer Gen Failed:', error);
    return { success: false, error: error.message };
  }
}

export async function saveOfferAction(data: any) {
  try {
    const user = await getAuthenticatedUser();
    console.log('💾 Saving Offer...');

    const items = data.items || [];
    const totalAmount = items.reduce((sum: number, item: any) => sum + (item.quantity * item.unitPrice), 0);
    const vatAmount = totalAmount * 0.25;
    const offer = await OfferRepo.create({
      ownerId: user.uid,
      projectId: data.projectId,
      title: data.title,
      items: items,
      introText: data.introText,
      closingText: data.closingText,
      totalAmount,
      vatAmount,
      status: 'draft'
    });
    return { success: true, offer };

    // TRIGGER OPTIMIZATION
    await recalculateProjectEconomy(data.projectId);

  } catch (error: any) {
    console.error('❌ Save Offer Failed:', error);
    return { success: false, error: error.message };
  }
}

export async function updateOfferAction(offerId: string, data: Partial<any>) {
  try {
    const user = await getAuthenticatedUser();
    // Verify ownership via repo or checkOwnership
    const existing = await OfferRepo.getById(offerId);
    if (!existing || existing.ownerId !== user.uid) throw new Error("Unauthorized");

    await OfferRepo.update(offerId, data);

    // TRIGGER OPTIMIZATION: If status changed or amount changed
    if (existing.projectId) {
      await recalculateProjectEconomy(existing.projectId);
    }

    return { success: true };
  } catch (error: any) {
    console.error('❌ Update Offer Failed:', error);
    return { success: false, error: error.message };
  }
}

export async function getOffersAction() {
  try {
    const user = await getAuthenticatedUser();
    const offers = await OfferRepo.listByOwner(user.uid);
    const plainOffers = offers.map(p => {
      const { createdAt, updatedAt, ...rest } = p as any;
      return {
        ...rest,
        createdAt: p.createdAt?.toDate ? p.createdAt.toDate().toISOString() : new Date().toISOString(),
        updatedAt: p.updatedAt?.toDate ? p.updatedAt.toDate().toISOString() : undefined
      };
    });
    return { success: true, offers: plainOffers };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

// --- INBOX INTELLIGENCE ---
export async function checkInboxAction(accessToken: string) {
  try {
    const user = await getAuthenticatedUser(); // Verify user session first!

    // Ensure accessToken is valid before calling service
    if (!accessToken) return { success: false, error: 'Access Token Missing' };

    console.log('📧 [SmartInbox] Checking for new messages...');

    // 1. Fetch Unread (CHEAP API CALL)
    const emails = await GmailService.listUnreadEmails(accessToken, 5);
    if (emails.length === 0) return { success: true, insights: [] };

    let myEmail = '';
    try {
      const profile = await GmailService.getProfile(accessToken);
      myEmail = profile.emailAddress || '';
    } catch (e) {
      console.warn("Could not fetch user profile for filtering", e);
    }

    // 2. Process each email with Smart Filter (Sequential to prevent Flash Mob)
    const insights = [];

    for (const email of emails) {
      // A. Self-Filter (Zero Cost)
      if (myEmail && email.from && email.from.includes(myEmail)) {
        continue;
      }

      // Ensure ID exists (TS Guard)
      if (!email.id) continue;

      // --- STAGE 1: THE MEMORY (Firestore Cache) ---
      const cacheRef = db.collection('processed_emails').doc(email.id);
      const cacheDoc = await cacheRef.get();

      if (cacheDoc.exists) {
        const cachedData = cacheDoc.data();
        console.log(`🧠 [SmartInbox] Hit Cache for ${email.id.substring(0, 5)}... Intent: ${cachedData?.intent}`);

        if (cachedData?.intent !== 'other') {
          insights.push({
            emailId: email.id,
            intent: cachedData?.intent,
            confidence: cachedData?.confidence,
            summary: cachedData?.summary,
            proposedAction: cachedData?.proposedAction,
            ataId: cachedData?.ataId,
            calendarData: cachedData?.calendarData,
            leadData: cachedData?.leadData,
            original: email
          });
        }
        continue;
      }

      // --- STAGE 2: THE BOUNCER (Keyword Heuristic) ---
      const combinedText = (email.subject + " " + (email.snippet || "")).toLowerCase();
      const relevantKeywords = ['boka', 'möte', 'tid', 'jobb', 'offert', 'renovering', 'badrum', 'kök', 'bygg', 'projekt', 'adress', 'pris', 'kostnad', 'hjälp', 'förfrågan', 'godkän', 'svar', 'hej'];
      const seemsRelevant = relevantKeywords.some(kw => combinedText.includes(kw));

      if (!seemsRelevant) {
        console.log(`🛡️ [SmartInbox] Bounced irrelevant email: ${email.subject}`);
        await cacheRef.set({
          intent: 'other',
          summary: 'Irrelevant (Heuristic)',
          analyzedAt: new Date(),
          subject: email.subject
        });
        continue;
      }

      // --- STAGE 3: THE EXPERT (AI Analysis) ---
      console.log(`🤖 [SmartInbox] Analyzing NEW potential lead/task: ${email.subject}`);

      try {
        const analysis = await emailAnalysisFlow({
          subject: email.subject || '',
          sender: email.from || '',
          body: email.snippet || '',
        });

        await cacheRef.set({
          ...analysis,
          analyzedAt: new Date(),
          subject: email.subject,
          sender: email.from
        });

        insights.push({ emailId: email.id, ...analysis, original: email });

      } catch (e) {
        console.error('❌ AI Analysis Failed:', e);
        // Don't cache failures
      }
    }

    // Sort by confidence
    const actionableInsights = insights.sort((a, b) => (b.confidence || 0) - (a.confidence || 0));

    return { success: true, insights: actionableInsights };
  } catch (error: any) {
    console.error('❌ Check Inbox Failed:', error);
    return { success: false, error: error.message };
  }
}

export async function createCalendarEventAction(accessToken: string, eventData: any) {
  try {
    await getAuthenticatedUser();
    console.log('📅 Creating Event:', eventData.summary);
    const startTime = eventData.suggestedDate || new Date().toISOString();
    const startDate = new Date(startTime);
    const endDate = new Date(startDate.getTime() + 60 * 60 * 1000);

    const result = await CalendarService.createEvent(accessToken, {
      summary: eventData.subject,
      description: eventData.description,
      startTime: startDate.toISOString(),
      endTime: endDate.toISOString()
    });

    return { success: true, eventLink: result.htmlLink };
  } catch (error: any) {
    console.error('❌ Create Event Failed:', error);
    return { success: false, error: error.message };
  }
}

export async function checkAvailabilityAction(accessToken: string, timeMin: string, timeMax: string) {
  try {
    await getAuthenticatedUser();
    const events = await CalendarService.listEvents(accessToken, timeMin, timeMax);
    const hasConflict = events.length > 0;
    return { success: true, hasConflict, conflicts: events };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function getUserStatusAction(uid?: string) {
  try {
    // If no UID arg, use authenticated user (safe)
    const user = await getAuthenticatedUser();
    // If UID is provided, we could check if it matches, OR allow admin to check? 
    // Stick to strict self-check for now

    console.log(`🔍 [getUserStatusAction] Fetching status for uid: ${user.uid}`);
    const userDoc = await db.collection('users').doc(user.uid).get();

    if (!userDoc.exists) {
      console.log(`⚠️ [getUserStatusAction] User doc not found for uid: ${user.uid}`);
      return { isOnboardingCompleted: false, exists: false };
    }

    const data = userDoc.data();
    console.log(`📄 [getUserStatusAction] Data retrieved:`, JSON.stringify(data, null, 2));

    const isOnboardingCompleted =
      data?.onboardingCompleted === true ||
      data?.onboardingCompleted === 'true';

    console.log(`✅ [getUserStatusAction] Final Status: ${isOnboardingCompleted}`);

    return {
      isOnboardingCompleted,
      exists: true
    };
  } catch (error: any) {
    console.error('❌ [getUserStatusAction] Error fetching user status:', error);
    return { isOnboardingCompleted: false, exists: false, error: error.message };
  }
}

export async function approveChangeOrderAction(ataId: string, approved: boolean, method: 'link' | 'email' | 'manual' = 'manual', evidence: string = '') {
  try {
    const user = await getAuthenticatedUser();
    // Use checkOwnership on the Project (ata stores projectId, need to traverse or trust ATA repo checks if implemented)
    // ATA Repo likely lacks check. We must fetch ATA, get ProjectID, check Project Ownership.
    const { ChangeOrderRepo } = await import('@/lib/dal/ata.repo');
    const ata = await ChangeOrderRepo.get(ataId);
    if (!ata) throw new Error("ATA not found");

    // Verify ownership of the PARENT project
    await checkOwnership(ata.projectId, 'projects', user);

    console.log(`📝 ÄTA Approval: ${ataId} -> ${approved ? 'Approved' : 'Rejected'} via ${method}`);
    await ChangeOrderRepo.updateStatus(ataId, approved ? 'approved' : 'rejected', method, evidence);

    // TRIGGER OPTIMIZATION
    await recalculateProjectEconomy(ata.projectId);

    return { success: true };
  } catch (error: any) {
    console.error('❌ ÄTA Approval Failed:', error);
    return { success: false, error: error.message };
  }
}

export async function getChangeOrdersAction(projectId: string) {
  try {
    const user = await getAuthenticatedUser();
    await checkOwnership(projectId, 'projects', user);

    const { ChangeOrderRepo } = await import('@/lib/dal/ata.repo');
    const orders = await ChangeOrderRepo.listByProject(projectId);
    const plainOrders = orders.map(o => {
      const { createdAt, approvedAt, ...rest } = o as any;
      return {
        ...rest,
        createdAt: o.createdAt?.toDate ? o.createdAt.toDate().toISOString() : new Date().toISOString(),
        approvedAt: o.approvedAt?.toDate ? o.approvedAt.toDate().toISOString() : undefined
      };
    });
    return { success: true, orders: plainOrders };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function createChangeOrderAction(data: { projectId: string, description: string, estimatedCost: number, quantity: number, unit: string, type: 'material' | 'work' | 'other' }) {
  try {
    const user = await getAuthenticatedUser();
    await checkOwnership(data.projectId, 'projects', user);

    const { ChangeOrderRepo } = await import('@/lib/dal/ata.repo');
    const newOrder = await ChangeOrderRepo.create(data);

    // TRIGGER OPTIMIZATION
    await recalculateProjectEconomy(data.projectId);

    return { success: true, order: { ...newOrder, createdAt: newOrder.createdAt?.toDate ? newOrder.createdAt.toDate().toISOString() : new Date().toISOString() } };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function finalizeProjectAction(projectId: string) {
  try {
    const user = await getAuthenticatedUser();
    const project = await checkOwnership(projectId, 'projects', user) as any;

    console.log(`🏁 Finalizing Project: ${project.name}`);

    // 1. Fetch Data
    const { OfferRepo } = await import('@/lib/dal/offer.repo');
    const { ChangeOrderRepo } = await import('@/lib/dal/ata.repo');
    const { CustomerRepo } = await import('@/lib/dal/customer.repo');

    const [offers, atas, customer] = await Promise.all([
      OfferRepo.listByProject(projectId),
      ChangeOrderRepo.listByProject(projectId),
      project.customerId ? CustomerRepo.get(project.customerId) : Promise.resolve(null)
    ]);

    const acceptedOffers = offers.filter(o => o.status === 'accepted');
    const approvedAtas = atas.filter(a => a.status === 'approved');

    // 2. Economy Calculation
    let totalNet = 0;
    acceptedOffers.forEach(o => totalNet += o.totalAmount);
    approvedAtas.forEach(a => totalNet += a.estimatedCost);

    // 3. Logic: Reverse VAT
    const isCompany = customer?.type === 'company' || (customer?.orgNumber && customer.orgNumber.length > 8);
    const vatRate = isCompany ? 0 : 0.25;
    const vatAmount = totalNet * vatRate;
    const totalGross = totalNet + vatAmount;

    // 4. Generate HTML Content
    let html = `<h1>Fakturaunderlag: ${project.name}</h1>`;
    html += `<p><strong>Datum:</strong> ${new Date().toLocaleDateString('sv-SE')}</p>`;
    html += `<p><strong>Kund:</strong> ${project.customerName || 'Okänd'} ${isCompany ? '(Företag)' : '(Privat)'}</p>`;
    if (isCompany) {
      html += `<p style="color:red; font-weight:bold;">⚠️ OMVÄND BETALNINGSSKYLDIGHET FÖR BYGGTJÄNSTER GÄLLER</p>`;
    }
    html += `<hr><h2>Offerter</h2><ul>`;
    acceptedOffers.forEach(o => {
      html += `<li>${o.title}: <strong>${o.totalAmount.toLocaleString('sv-SE')} kr</strong></li>`;
    });
    html += `</ul><h2>ÄTA (Ändringar & Tillägg)</h2><ul>`;
    approvedAtas.forEach(a => {
      html += `<li>${a.description}: <strong>${a.estimatedCost.toLocaleString('sv-SE')} kr</strong></li>`;
    });
    html += `</ul><hr>`;
    html += `<h3>Netto: ${totalNet.toLocaleString('sv-SE')} kr</h3>`;
    html += `<h3>Moms (${vatRate * 100}%): ${vatAmount.toLocaleString('sv-SE')} kr</h3>`;
    html += `<h1>ATT BETALA: ${totalGross.toLocaleString('sv-SE')} kr</h1>`;

    // 5. Create Google Doc
    if (!project.driveFolderId) throw new Error("Drive folder missing");

    const drive = await getDriveService();
    // Find '3_Ekonomi'
    const qEkonomi = `'${project.driveFolderId}' in parents and name contains 'Ekonomi' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
    const resEkonomi = await (await drive.files.list({ q: qEkonomi })).data;
    let economyFolderId = resEkonomi.files?.[0]?.id;

    // Fallback if structure broken
    if (!economyFolderId) economyFolderId = project.driveFolderId;

    const docTitle = `Fakturaunderlag - ${project.name} - ${new Date().toISOString().split('T')[0]}`;
    const newDoc = await drive.createGoogleDoc(docTitle, html, economyFolderId);

    return { success: true, message: "Fakturaunderlag skapat!", docLink: newDoc.webViewLink };

  } catch (error: any) {
    console.error("❌ Finalize Project Failed:", error);
    return { success: false, error: error.message };
  }
}

// --- COMPANY SETTINGS ---
export async function getCompanyProfileAction() {
  try {
    const user = await getAuthenticatedUser();
    const dbUser = await UserRepo.get(user.uid);
    if (!dbUser?.companyId) return { success: false, error: 'No company found for user' };

    const company = await CompanyRepo.get(dbUser.companyId);
    // Implicit ownership check: We only got company from User's OWN record
    return { success: true, profile: company?.profile, context: company?.context };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function saveCompanyProfileAction(data: { profile: any, context: any }) {
  try {
    const user = await getAuthenticatedUser();
    const dbUser = await UserRepo.get(user.uid);
    if (!dbUser?.companyId) return { success: false, error: 'No company found' };

    await CompanyRepo.updateProfile(dbUser.companyId, data);
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

// --- CUSTOMERS (CRM) ---
import { CustomerRepo, CustomerData } from '@/lib/dal/customer.repo';

export async function getCustomersAction() {
  try {
    const user = await getAuthenticatedUser();
    const dbUser = await UserRepo.get(user.uid);
    if (!dbUser?.companyId) return { success: false, error: 'No company found' };
    const customers = await CustomerRepo.listByCompany(dbUser.companyId);

    // Serializing dates
    const plainCustomers = customers.map(c => {
      const { createdAt, updatedAt, ...rest } = c as any;
      return {
        ...rest,
        createdAt: c.createdAt?.toDate ? c.createdAt.toDate().toISOString() : new Date().toISOString(),
        updatedAt: c.updatedAt?.toDate ? c.updatedAt.toDate().toISOString() : undefined,
      };
    });

    return { success: true, customers: plainCustomers };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function getCustomerAction(customerId: string) {
  try {
    const user = await getAuthenticatedUser();
    const customer = await CustomerRepo.get(customerId);
    if (!customer) return { success: false, error: 'Customer not found' };

    // Check Ownership/Company
    const dbUser = await UserRepo.get(user.uid);
    if (customer.companyId !== dbUser?.companyId) {
      throw new Error("Unauthorized");
    }

    return {
      success: true,
      customer: {
        ...customer,
        createdAt: customer.createdAt?.toDate ? customer.createdAt.toDate().toISOString() : undefined,
        updatedAt: customer.updatedAt?.toDate ? customer.updatedAt.toDate().toISOString() : undefined,
      }
    };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function createCustomerAction(data: Partial<CustomerData>) {
  try {
    const user = await getAuthenticatedUser();
    const dbUser = await UserRepo.get(user.uid);
    if (!dbUser?.companyId) return { success: false, error: 'No company found' };

    const newCustomer = await CustomerRepo.create({
      companyId: dbUser.companyId,
      name: data.name!,
      type: data.type || 'private',
      orgNumber: data.orgNumber || '',
      email: data.email || '',
      phone: data.phone || '',
      address: data.address || '',
      status: 'lead',
      notes: ''
    });

    return { success: true, customerId: newCustomer.id };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function updateCustomerAction(customerId: string, data: Partial<CustomerData>) {
  try {
    const user = await getAuthenticatedUser();
    const customer = await CustomerRepo.get(customerId);
    if (!customer) throw new Error("NotFound");

    const dbUser = await UserRepo.get(user.uid);
    if (customer.companyId !== dbUser?.companyId) throw new Error("Unauthorized");

    await CustomerRepo.update(customerId, data);
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function deleteCustomerAction(customerId: string) {
  try {
    const user = await getAuthenticatedUser();
    const customer = await CustomerRepo.get(customerId);
    if (!customer) throw new Error("NotFound");

    const dbUser = await UserRepo.get(user.uid);
    if (customer.companyId !== dbUser?.companyId) throw new Error("Unauthorized");

    await CustomerRepo.delete(customerId);
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

// --- GLOBAL STATUS (YELLOW DOTS) ---
export async function getGlobalStatusAction() {
  try {
    const user = await getAuthenticatedUser();
    const dbUser = await UserRepo.get(user.uid);
    if (!dbUser?.companyId) return { success: false, error: 'No company' };

    const company = await CompanyRepo.get(dbUser.companyId);
    const customers = await CustomerRepo.listByCompany(dbUser.companyId);

    // 1. Profile Completeness
    const profile = company?.profile;
    const profileIncomplete = !profile?.address || !profile?.orgNumber || !profile?.contactEmail;

    // 2. Customer Completeness
    const incompleteCustomers = customers.filter(c => c.completeness < 80).length;

    return {
      success: true,
      profileIncomplete,
      incompleteCustomersCount: incompleteCustomers,
      hasWarnings: profileIncomplete || incompleteCustomers > 0
    };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

// --- OFFERS (FAS 6) ---
import { RecipeRepo } from '@/lib/dal/recipe.repo';
import { calculateOfferTool } from '@/lib/genkit/tools/calculation.tools';
import { generateOfferTool } from '@/lib/genkit/tools/pdf.tools';

export async function getRecipesAction() {
  try {
    await getAuthenticatedUser();
    let recipes = await RecipeRepo.list();

    // SEEDING: If no recipes exist, create standard templates
    if (recipes.length === 0) {
      console.log("🌱 Seeding Default Recipes...");
      const defaultRecipes = [
        {
          name: 'Badrumsrenovering (Standard)',
          description: 'Helrenovering av badrum inkl. tätskikt och kakel.',
          laborHoursPerUnit: 12, // ca 12h per m2 totalt snitt?
          riskFactor: 0.15,
          materials: [
            { name: 'Tätskiktssystem', unit: 'm2', costPerUnit: 450, quantityPerUnit: 1.1 },
            { name: 'Kakel/Klinker', unit: 'm2', costPerUnit: 600, quantityPerUnit: 1.1 },
            { name: 'Fästmassa/Fog', unit: 'kg', costPerUnit: 40, quantityPerUnit: 4 },
            { name: 'VVS-material (Schablon)', unit: 'st', costPerUnit: 200, quantityPerUnit: 0.5 }
          ],
          kmaRequirements: ['Härdplaster (Härdarn)', 'Tunga lyft']
        },
        {
          name: 'Målning Vägg & Tak',
          description: 'Bredspackling och målning.',
          laborHoursPerUnit: 1.5,
          riskFactor: 0.05,
          materials: [
            { name: 'Spackel', unit: 'liter', costPerUnit: 30, quantityPerUnit: 2 },
            { name: 'Grundfärg', unit: 'liter', costPerUnit: 80, quantityPerUnit: 0.2 },
            { name: 'Täckfärg', unit: 'liter', costPerUnit: 150, quantityPerUnit: 0.3 },
            { name: 'Täckpapp & Tejp', unit: 'm2', costPerUnit: 15, quantityPerUnit: 1.1 }
          ],
          kmaRequirements: ['Damm', 'Arbete på bock']
        }
      ];

      for (const r of defaultRecipes) {
        await RecipeRepo.create(r);
      }
      recipes = await RecipeRepo.list(); // Re-fetch
    }

    return { success: true, recipes };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function calculateOfferAction(input: any) {
  try {
    await getAuthenticatedUser();
    const result = await calculateOfferTool(input);
    return { success: true, data: result };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function createOfferPdfAction(input: any) {
  try {
    await getAuthenticatedUser();
    const result = await generateOfferTool(input);
    return { success: true, data: result };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

// --- RISKS (PHASE 7) ---
export async function getRisksAction(projectId: string) {
  try {
    const user = await getAuthenticatedUser();
    await checkOwnership(projectId, 'projects', user);

    const { RiskRepo } = await import('@/lib/dal/risk.repo');
    const risks = await RiskRepo.listByProject(projectId);
    return { success: true, risks };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function mitigateRiskAction(riskId: string) {
  try {
    const user = await getAuthenticatedUser();

    // IDOR Check: Risk -> Project -> Owner
    const { RiskRepo } = await import('@/lib/dal/risk.repo');
    const risk = await RiskRepo.get(riskId);
    if (!risk) throw new Error("Risk not found");

    await checkOwnership(risk.projectId, 'projects', user);

    const { db } = await import('@/lib/dal/server');
    await db.collection('risks').doc(riskId).update({ status: 'mitigated' });
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

// --- WEATHER (PHASE 9) ---
export async function getWeatherAction(address: string) {
  if (!address) return { success: false, error: 'No address provided' };

  try {
    await getAuthenticatedUser();
    const { GeocodingService } = await import('@/lib/external/geocoding');
    const coords = await GeocodingService.getCoordinates(address);

    if (!coords) return { success: false, error: 'Address not found' };

    const { SMHIService } = await import('@/lib/external/smhi');
    const weather = await SMHIService.getForecast(coords.lat, coords.lon);

    return { success: true, weather };
  } catch (error: any) {
    console.error("Weather Action Failed:", error);
    return { success: false, error: error.message };
  }
}

// --- DASHBOARD (PHASE 8) ---
export async function getCriticalStopsAction() {
  try {
    const user = await getAuthenticatedUser();

    // 1. Fetch Draft ÄTAs (Unapproved Money)
    const { db } = await import('@/lib/dal/server');
    const projectsRef = db.collection('projects').where('ownerId', '==', user.uid).where('status', '==', 'active').limit(10);
    const projectsSnap = await projectsRef.get();
    const projectIds = projectsSnap.docs.map(d => d.id);
    const projectNames: Record<string, string> = {};
    projectsSnap.docs.forEach(d => projectNames[d.id] = d.data().name);

    const stops: any[] = [];

    if (projectIds.length > 0) {
      // Find Draft ÄTAs
      const ataRef = db.collection('change_orders')
        .where('projectId', 'in', projectIds.slice(0, 10))
        .where('status', '==', 'draft');

      const ataSnap = await ataRef.get();
      ataSnap.docs.forEach(d => {
        const data = d.data();
        stops.push({
          id: d.id,
          type: 'ata',
          title: `Utkast ÄTA: ${data.description}`,
          subtitle: `${projectNames[data.projectId]} - ${data.estimatedCost} kr (Ej godkänd)`,
          severity: 'medium',
          link: `/projects/${data.projectId}/ata`
        });
      });

      // Find Overdue Invoices
      const invRef = db.collection('invoices')
        .where('projectId', 'in', projectIds.slice(0, 10))
        .where('status', '==', 'sent'); // Check if overdue in code

      const invSnap = await invRef.get();
      const now = new Date();
      invSnap.docs.forEach(d => {
        const data = d.data();
        const due = data.dueDate?.toDate ? data.dueDate.toDate() : new Date(); // Safety check
        if (due < now) {
          stops.push({
            id: d.id,
            type: 'invoice',
            title: `Förfallen Faktura: ${data.id}`,
            subtitle: `${projectNames[data.projectId]} - ${data.amount} kr`,
            severity: 'high',
            link: `/projects/${data.projectId}`
          });
        }
      });
    }

    return { success: true, items: stops };
  } catch (e: any) {
    console.error("Critical Stops Failed:", e);
    return { success: false, items: [] };
  }
}
// --- ECONOMY & RECEIPTS ---
export async function logReceiptExpenseAction(projectId: string, receiptData: { vendor?: string, date?: string, totalAmount?: number, items?: string[], category?: string }, imageBase64?: string) {
  try {
    const user = await getAuthenticatedUser();
    const project = await checkOwnership(projectId, 'projects', user) as any;

    // 1. Prepare Data
    const vendor = receiptData.vendor || "Okänt inköpsställe";
    const date = receiptData.date || new Date().toISOString().split('T')[0];
    const amount = receiptData.totalAmount || 0;
    const items = receiptData.items?.join(", ") || "Diverse";

    console.log(`🧾 Logging Receipt for ${project.name}: ${vendor} - ${amount}kr`);

    if (!project.driveFolderId) {
      return { success: false, error: "Project has no Drive Folder connected." };
    }

    const drive = await getDriveService();

    // 2. Navigate Folder Structure: Project -> 3_Ekonomi -> Kvitton
    // We need to find '3_Ekonomi' inside projectFolder
    // Note: We might optimize this by storing folder IDs in Firestore to avoid searching every time

    // Find "3_Ekonomi"
    // We assume the structure exists. If not, we might need to recreate it or fail.
    // Let's search loosely for "Ekonomi" to be safe against "3_Ekonomi" vs "03_Ekonomi" naming
    const qEkonomi = `'${project.driveFolderId}' in parents and name contains 'Ekonomi' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
    const resEkonomi = await (await drive.files.list({ q: qEkonomi })).data;
    let economyFolderId = resEkonomi.files?.[0]?.id;

    if (!economyFolderId) {
      // Fallback: Create it
      console.log("⚠️ Economy folder missing, creating...");
      economyFolderId = await drive.ensureFolderExists("3_Ekonomi", project.driveFolderId);
    }

    // Find/Create "Kvitton"
    const receiptFolderId = await drive.ensureFolderExists("Kvitton", economyFolderId!);

    // 3. Upload Image (if provided)
    let imageUrl = "";
    if (imageBase64) {
      // Remove header if present (data:image/jpeg;base64,...)
      const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, "");
      const buffer = Buffer.from(base64Data, 'base64');
      const filename = `Kvitto - ${vendor} - ${date}.jpg`;

      const file = await drive.uploadFile(filename, 'image/jpeg', buffer, receiptFolderId); // Helper might need buffer stream adaptation
      // checking drive.ts uploadFile... it takes 'body'. googleapis usually wants a stream or string.
      // If 'body' is passed to media.body, Buffer works in Node.
      imageUrl = file.webViewLink;
    }

    // 4. Update "Utlägg & Kvitton" Google Doc
    // Search for existing doc
    const docName = `Utlägg & Kvitton - ${project.name}`;
    const qDoc = `'${economyFolderId}' in parents and name = '${docName}' and mimeType = 'application/vnd.google-apps.document' and trashed = false`;
    const resDoc = await (await drive.files.list({ q: qDoc })).data;
    let docId = resDoc.files?.[0]?.id;
    let docLink = resDoc.files?.[0]?.webViewLink;

    if (!docId) {
      console.log("📝 Creating new Receipt Log Doc...");
      const newDoc = await drive.createGoogleDoc(docName, `<h1>Utlägg & Kvitton - ${project.name}</h1><p>Här samlas alla utlägg och kvitton för projektet.</p><hr>`, economyFolderId);
      docId = newDoc.id;
      docLink = newDoc.webViewLink;
    }

    // Append Table Row-like format
    const entry = `\nDATUM: ${date} | LEVERANTÖR: ${vendor} | BELOPP: ${amount} kr\nARTIKLAR: ${items}\nLÄNK: ${imageUrl || 'Ingen bild'}\n----------------------------------------`;
    await drive.appendContentToDoc(docId!, entry);

    return { success: true, message: "Kvitto sparat!", docLink };

  } catch (error: any) {
    console.error("❌ Log Receipt Failed:", error);
    return { success: false, error: error.message };
  }
}

export async function getCriticalStopsAction() {
  try {
    const user = await getAuthenticatedUser();
    const { ProjectRepo } = await import('@/lib/dal/project.repo');
    const { ChangeOrderRepo } = await import('@/lib/dal/ata.repo');

    // 1. Get Active Projects
    const projects = await ProjectRepo.listByOwner(user.uid);
    const activeProjects = projects.filter(p => p.status === 'active');

    const items: any[] = [];

    // 2. Scan for Issues
    for (const p of activeProjects) {
      // A. Check Unbilled ATAs (Simple Heuristic: If approved ATA exists, flag it if project is old or just list as reminder)
      // Ideally we check if it's LINKED to an invoice. For now, we just count them.
      const atas = await ChangeOrderRepo.listByProject(p.id);
      const approvedUnbilled = atas.filter(a => a.status === 'approved'); // Assuming we don't have 'invoiced' status yet

      if (approvedUnbilled.length > 0) {
        items.push({
          id: `invoice-${p.id}`,
          type: 'invoice',
          title: `Fakturera ${p.name}`,
          subtitle: `${approvedUnbilled.length} st godkända ÄTA väntar på fakturering.`,
          severity: 'high',
          link: `/projects/${p.id}/economy`
        });
      }

      // B. Safety Check (High Risk Keywords)
      const isHighRisk = (p.description + p.name).toLowerCase().match(/(tak|ställning|hög höjd|grop|schakt)/);
      if (isHighRisk) {
        // We can't easily check for AMP file existence efficiently here without checking Drive. 
        // We create a "Warning" to Verify AMP.
        items.push({
          id: `risk-${p.id}`,
          type: 'risk',
          title: `Saknas AMP? (${p.name})`,
          subtitle: "Projektet verkar innefatta riskfyllda moment. Kontrollera att AMP är upprättad.",
          severity: 'medium',
          link: `/projects/${p.id}/kma`
        });
      }
    }

    return { success: true, items };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
