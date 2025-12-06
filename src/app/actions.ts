'use server';

import { ai } from '@/lib/genkit';

export async function generateTextAction(prompt: string) {
  try {
    const { text } = await ai.generate({
      model: 'googleai/gemini-2.5-flash',
      prompt: prompt,
      config: {
        temperature: 0.7,
      },
    });

    return { success: true, text };
  } catch (error: any) {
    console.error("Genkit Error:", error);
    return { success: false, error: error.message };
  }
}

// NOTE: We removed the top-level firebase-admin import to prevent crashes if credentials are missing locally.
// If you need admin access, import it dynamically inside the function or ensure GOOGLE_APPLICATION_CREDENTIALS is set.

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
// ... existing code ...

import { chatFlow } from '@/lib/genkit/flows/chat';

export async function chatAction(messages: any[]) {
  try {
    console.log('💬 Chat Action Triggered');
    const response = await chatFlow({ messages });
    console.log('✅ Chat Action Success');
    return { success: true, text: response };
  } catch (error: any) {
    console.error('❌ Chat Action Failed:', error);
    return { success: false, error: error.message || 'Unknown error' };
  }
}
// ... existing code ...

import { ProjectRepo, ProjectData } from '@/lib/dal/project.repo';

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
    // Serialize timestamps for Client Components if needed (Next.js warns about passing plain objects with methods)
    // Firestore timestamps have toMillis(), so we might need to convert.
    // For now, let's return raw and see if Next.js complains (it usually does with class instances).
    // converting to plain object:
    const plainProjects = projects.map(p => ({
      ...p,
      createdAt: p.createdAt.toDate().toISOString() // Convert Timestamp to string
    }));

    return { success: true, projects: plainProjects };
  } catch (error: any) {
    console.error('❌ Get Projects Failed:', error);
    return { success: false, error: error.message };
  }
}
// ... existing code ...

import { offerFlow } from '@/lib/genkit/flows/offer';
import { OfferRepo, OfferData } from '@/lib/dal/offer.repo';

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

export async function saveOfferAction(data: any) { // Type 'any' for speed, ideally OfferData
  try {
    console.log('💾 Saving Offer...');
    if (!data.ownerId) throw new Error('Missing ownerId');

    // Calculate totals if missing (safety net)
    const items = data.items || [];
    const totalAmount = items.reduce((sum: number, item: any) => sum + (item.quantity * item.unitPrice), 0);
    const vatAmount = totalAmount * 0.25; // 25% Moms default

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
