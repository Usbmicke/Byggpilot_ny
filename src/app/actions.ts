'use server';

import { ai } from '@/lib/genkit';
import { chatFlow } from '@/lib/genkit/flows/chat';
import { offerFlow } from '@/lib/genkit/flows/offer';
import { emailAnalysisFlow } from '@/lib/genkit/flows/email-analysis';
import { ProjectRepo } from '@/lib/dal/project.repo';
import { OfferRepo } from '@/lib/dal/offer.repo';
import { GmailService } from '@/lib/google/gmail';
import { CalendarService } from '@/lib/google/calendar';

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
    const metadata = {
      name: `ByggPilot - ${companyName}`,
      mimeType: 'application/vnd.google-apps.folder',
    };
    console.log("📂 Server Action: Attempting to create Drive folder for:", companyName);
    const response = await fetch('https://www.googleapis.com/drive/v3/files', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(metadata),
    });
    if (!response.ok) {
      const errorData = await response.json();
      console.error("❌ Drive API Error (Server Action):", errorData);
      return { success: false, error: JSON.stringify(errorData) };
    }
    const file = await response.json();
    console.log("✅ Drive Folder Created:", file.id);
    return { success: true, folderId: file.id };
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
export async function createProjectAction(data: { name: string; address?: string; customerName?: string; description?: string; ownerId: string }) {
  try {
    console.log('🏗️ Create Project Action:', data.name);
    if (!data.ownerId) throw new Error('Missing ownerId');
    const project = await ProjectRepo.create({
      ownerId: data.ownerId,
      name: data.name,
      address: data.address,
      customerName: data.customerName,
      description: data.description,
      status: 'active'
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
    const userDoc = await ProjectRepo.db.collection('users').doc(uid).get();
    if (!userDoc.exists) return { isOnboardingCompleted: false, exists: false };
    return {
      isOnboardingCompleted: userDoc.data()?.onboardingCompleted === true,
      exists: true
    };
  } catch (error) {
    console.error('Error fetching user status:', error);
    return { isOnboardingCompleted: false, exists: false };
  }
}
