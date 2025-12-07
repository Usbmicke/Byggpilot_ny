'use server';

import { ai } from '@/lib/genkit';
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

// --- AI GENERATION ---
export async function generateTextAction(prompt: string) {
  try {
    const { text } = await ai.generate({
      model: 'googleai/gemini-2.5-flash',
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
export async function chatAction(messages: any[]) {
  try {
    console.log('💬 Chat Action Triggered');
    const response = await chatFlow({ messages });
    return { success: true, text: response };
  } catch (error: any) {
    console.error('❌ Chat Action Failed:', error);
    return { success: false, error: error.message || 'Unknown error' };
  }
}

// --- PROJECTS ---
export async function createProjectAction(data: { name: string; address?: string; customerName?: string; description?: string; ownerId: string; accessToken?: string }) {
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
    console.log('🏗️ Create Project Action:', data.name);
    if (!data.ownerId) throw new Error('Missing ownerId');

    let driveFolderId = undefined;

    // Robust Drive Creation Logic
    if (data.accessToken) {
      try {
        console.log("📂 Initiating Drive Folder Creation...");
        const user = await UserRepo.get(data.ownerId);
        if (user?.companyId) {
          const company = await CompanyRepo.get(user.companyId);
          if (company) {
            const rootName = `ByggPilot - ${company.name}`;
            let rootId = await findDriveFolder(data.accessToken, rootName);

            if (!rootId) {
              console.log("root folder not found, creating:", rootName);
              rootId = await createDriveFolder(data.accessToken, rootName);
            }

            if (rootId) {
              let projectsId = await findDriveFolder(data.accessToken, 'Projekt', rootId);
              if (!projectsId) {
                console.log("Projects folder not found, creating...");
                projectsId = await createDriveFolder(data.accessToken, 'Projekt', rootId);
              }

              if (projectsId) {
                driveFolderId = await createDriveFolder(data.accessToken, data.name, projectsId);
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
      ownerId: data.ownerId,
      name: data.name,
      address: data.address,
      customerName: data.customerName,
      description: data.description,
      status: 'active',
      driveFolderId,
    });
    return { success: true, project };
  } catch (error: any) {
    console.error('❌ Create Project Failed:', error);
    return { success: false, error: error.message };
  }
}

export async function getProjectsAction(ownerId: string) {
  try {
    if (!ownerId) return { success: false, error: 'No owner ID provided' };
    const projects = await ProjectRepo.listByOwner(ownerId);
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

// --- OFFERS ---
export async function generateOfferAction(projectTitle: string, notes: string) {
  try {
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
    console.log('💾 Saving Offer...');
    if (!data.ownerId) throw new Error('Missing ownerId');
    const items = data.items || [];
    const totalAmount = items.reduce((sum: number, item: any) => sum + (item.quantity * item.unitPrice), 0);
    const vatAmount = totalAmount * 0.25;
    const offer = await OfferRepo.create({
      ownerId: data.ownerId,
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

export async function getOffersAction(ownerId: string) {
  try {
    const offers = await OfferRepo.listByOwner(ownerId);
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
    console.log('📧 Checking Inbox...');
    // Ensure accessToken is valid before calling service
    if (!accessToken) return { success: false, error: 'Access Token Missing' };

    const emails = await GmailService.listUnreadEmails(accessToken, 5);
    if (emails.length === 0) return { success: true, insights: [] };

    const insights = await Promise.all(emails.map(async (email) => {
      try {
        const analysis = await emailAnalysisFlow({
          subject: email.subject || '',
          sender: email.from || '',
          body: email.snippet || '',
        });
        return { emailId: email.id, ...analysis, original: email };
      } catch (e) {
        console.error('AI Failed for email', email.id, e);
        return null;
      }
    }));

    const actionableInsights = insights
      .filter(i => i !== null && i.intent !== 'other')
      .sort((a, b) => b!.confidence - a!.confidence);

    return { success: true, insights: actionableInsights };
  } catch (error: any) {
    console.error('❌ Check Inbox Failed:', error);
    return { success: false, error: error.message };
  }
}

export async function createCalendarEventAction(accessToken: string, eventData: any) {
  try {
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

export async function getUserStatusAction(uid: string) {
  try {
    console.log(`🔍 [getUserStatusAction] Fetching status for uid: ${uid}`);
    const userDoc = await db.collection('users').doc(uid).get();

    if (!userDoc.exists) {
      console.log(`⚠️ [getUserStatusAction] User doc not found for uid: ${uid}`);
      return { isOnboardingCompleted: false, exists: false };
    }

    const data = userDoc.data();
    console.log(`📄 [getUserStatusAction] Data retrieved:`, JSON.stringify(data, null, 2));

    // Robust check for boolean true, string "true", or existence implies completed if schema changed
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

export async function approveChangeOrderAction(ataId: string, approved: boolean) {
  try {
    console.log(`📝 ÄTA Approval: ${ataId} -> ${approved ? 'Approved' : 'Rejected'}`);
    const { ChangeOrderRepo } = await import('@/lib/dal/ata.repo');
    await ChangeOrderRepo.updateStatus(ataId, approved ? 'approved' : 'rejected');
    return { success: true };
  } catch (error: any) {
    console.error('❌ ÄTA Approval Failed:', error);
    return { success: false, error: error.message };
  }
}

export async function finalizeProjectAction(projectId: string) {
  return { success: true, message: "Faktura-generering under konstruktion (PDF)" };
}
