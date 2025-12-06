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
