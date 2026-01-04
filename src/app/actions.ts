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

export async function getProjectsAction() {
  try {
    const user = await getAuthenticatedUser();
    const projects = await ProjectRepo.listByOwner(user.uid);
    const plainProjects = projects.map(p => ({
      ...p,
      createdAt: p.createdAt.toDate().toISOString()
    }));
    return { success: true, projects: plainProjects };
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
  } catch (error: any) {
    console.error('❌ Save Offer Failed:', error);
    return { success: false, error: error.message };
  }
}

export async function getOffersAction() {
  try {
    const user = await getAuthenticatedUser();
    const offers = await OfferRepo.listByOwner(user.uid);
    const plainOffers = offers.map(p => ({
      ...p,
      createdAt: p.createdAt.toDate().toISOString(),
      updatedAt: p.updatedAt.toDate().toISOString()
    }));
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
    const plainOrders = orders.map(o => ({
      ...o,
      createdAt: o.createdAt.toDate().toISOString(),
      approvedAt: o.approvedAt?.toDate().toISOString()
    }));
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
    return { success: true, order: { ...newOrder, createdAt: newOrder.createdAt.toDate().toISOString() } };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function finalizeProjectAction(projectId: string) {
  const user = await getAuthenticatedUser();
  await checkOwnership(projectId, 'projects', user);
  return { success: true, message: "Faktura-generering under konstruktion (PDF)" };
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
    const plainCustomers = customers.map(c => ({
      ...c,
      createdAt: c.createdAt.toDate().toISOString(),
      updatedAt: c.updatedAt.toDate().toISOString(),
    }));

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
        createdAt: customer.createdAt.toDate().toISOString(),
        updatedAt: customer.updatedAt.toDate().toISOString(),
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
    await getAuthenticatedUser();
    const { db } = await import('@/lib/dal/server'); // Direct DB access for speed or use repo
    // Let's use repo if possible, but for now direct update is fine for this specific flag
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
