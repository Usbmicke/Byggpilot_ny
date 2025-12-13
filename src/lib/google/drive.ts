import 'server-only';
import { google } from 'googleapis';
import { drive_v3 } from '@googleapis/drive'; // Needed for types/instantiation
import { GoogleAuth } from 'google-auth-library';

// Lazy init to prevent ADC crash on load if env vars are missing
let _service: any = null;

const getService = (accessToken?: string) => {
    if (accessToken) {
        // console.log("🔐 [drive.ts] Using provided Access Token for Drive Service");
        // Create an OAuth2 client with the provided token
        const auth = new GoogleAuth();

        const oauth2 = new google.auth.OAuth2();
        oauth2.setCredentials({ access_token: accessToken });
        return google.drive({ version: 'v3', auth: oauth2 });
    }

    if (!_service) {
        console.log("⚙️ [drive.ts] Initializing Service Account Drive Client...");
        let authOptions: any = {
            scopes: ['https://www.googleapis.com/auth/drive'],
        };

        // Try to use the same Service Account as Firebase
        const saKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY || process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
        if (saKey) {
            try {
                const credentials = JSON.parse(saKey);
                authOptions.credentials = {
                    client_email: credentials.client_email,
                    private_key: credentials.private_key,
                };
                authOptions.projectId = credentials.project_id; // IMPORTANT: Set Project ID
                console.log(`✅ [drive.ts] Service Account Credentials loaded for: ${credentials.client_email}`);
            } catch (e) {
                console.error("❌ [drive.ts] Failed to parse Service Account for Drive:", e);
            }
        } else {
            console.warn("⚠️ [drive.ts] No Service Account Key found in env. Drive operations without Token will fail.");
        }

        const auth = new GoogleAuth(authOptions);
        _service = google.drive({ version: 'v3', auth: auth as any });
    }
    return _service;
};

export const GoogleDriveService = {
    async ensureFolderExists(folderName: string, parentId?: string, accessToken?: string): Promise<string> {
        const service = getService(accessToken);
        const query = [
            `mimeType = 'application/vnd.google-apps.folder'`,
            `name = '${folderName}'`,
            `trashed = false`,
            parentId ? `'${parentId}' in parents` : undefined,
        ].filter(Boolean).join(' and ');

        const res = await service.files.list({
            q: query,
            fields: 'files(id, name)',
            spaces: 'drive',
        });

        if (res.data.files && res.data.files.length > 0) {
            return res.data.files[0].id!;
        }

        // Create if not exists
        const fileMetadata: any = {
            name: folderName,
            mimeType: 'application/vnd.google-apps.folder',
        };
        if (parentId) {
            fileMetadata.parents = [parentId];
        }

        const file = await service.files.create({
            requestBody: fileMetadata,
            fields: 'id',
        });

        return file.data.id!;
    },

    async createProjectFolder(projectName: string, companyFolderId: string, accessToken?: string) {
        return this.ensureFolderExists(projectName, companyFolderId, accessToken);
    },

    async uploadFile(name: string, mimeType: string, body: any, parentId?: string, accessToken?: string): Promise<{ id: string, webViewLink: string }> {
        const service = getService(accessToken);

        const media = {
            mimeType: mimeType,
            body: body,
        };

        const fileMetadata: any = {
            name: name,
            parents: parentId ? [parentId] : [],
        };

        const res = await service.files.create({
            requestBody: fileMetadata,
            media: media,
            fields: 'id, webViewLink',
        });

        return {
            id: res.data.id!,
            webViewLink: res.data.webViewLink!,
        };
    },

    async createGoogleDoc(title: string, htmlContent: string, parentId?: string, accessToken?: string): Promise<{ id: string, webViewLink: string }> {
        const service = getService(accessToken);

        const fileMetadata = {
            name: title,
            mimeType: 'application/vnd.google-apps.document',
            parents: parentId ? [parentId] : []
        };

        const media = {
            mimeType: 'text/html',
            body: htmlContent
        };

        const res = await service.files.create({
            requestBody: fileMetadata,
            media: media,
            fields: 'id, webViewLink',
        });

        return {
            id: res.data.id!,
            webViewLink: res.data.webViewLink!,
        };
    },

    async renameFolder(fileId: string, newName: string, accessToken?: string) {
        const service = getService(accessToken);
        await service.files.update({
            fileId: fileId,
            requestBody: {
                name: newName
            }
        });
    },

    // --- ISO OFFICE STRUCTURE ---

    async ensureRootStructure(companyName: string, accessToken?: string) {
        // 1. Root Folder: "ByggPilot - [Company]"
        const rootName = `ByggPilot - ${companyName}`;
        const rootId = await this.ensureFolderExists(rootName, undefined, accessToken);

        // 2. Standard Subfolders
        const folders = [
            '01_Kunder & Anbud',
            '02_Pågående Projekt',
            '03_Avslutade Projekt',
            '04_Företagsmallar',
            '05_Bokföringsunderlag'
        ];

        const folderIds: Record<string, string> = {};

        for (const folder of folders) {
            folderIds[folder] = await this.ensureFolderExists(folder, rootId, accessToken);
        }

        // 3. Bokföring sub-structure
        const accountingId = folderIds['05_Bokföringsunderlag'];
        const currentYear = new Date().getFullYear().toString();
        const yearId = await this.ensureFolderExists(currentYear, accountingId, accessToken);
        await this.ensureFolderExists('Q1_Kvitton', yearId, accessToken);
        await this.ensureFolderExists('Q2_Kvitton', yearId, accessToken);
        await this.ensureFolderExists('Q3_Kvitton', yearId, accessToken);
        await this.ensureFolderExists('Q4_Kvitton', yearId, accessToken);

        return { rootId, folders: folderIds };
    },

    async appendContentToDoc(docId: string, textContent: string, accessToken?: string) {
        // Need Docs Service
        const auth = new google.auth.OAuth2();
        if (accessToken) auth.setCredentials({ access_token: accessToken });
        const docs = google.docs({ version: 'v1', auth });

        // 1. Get Document to find end index
        const doc = await docs.documents.get({ documentId: docId });
        const content = doc.data.body?.content;
        const endIndex = content ? content[content.length - 1].endIndex! - 1 : 1;

        // 2. Insert Text
        await docs.documents.batchUpdate({
            documentId: docId,
            requestBody: {
                requests: [
                    {
                        insertText: {
                            location: { index: endIndex },
                            text: '\n' + textContent + '\n'
                        }
                    }
                ]
            }
        });
    },

    async createProjectStructure(projectName: string, projectsRootId: string, accessToken?: string) {
        // 1. Create Project Root inside "02_Pågående Projekt"
        const projectRootId = await this.ensureFolderExists(projectName, projectsRootId, accessToken);

        // 2. Create Sub-folders
        const subfolders = [
            '1_Ritningar & Kontrakt',
            '2_Bilder & Dokumentation',
            '3_Ekonomi',
            '4_ÄTA',
            '5_KMA'
        ];

        const ids: Record<string, string> = {};
        for (const folder of subfolders) {
            ids[folder] = await this.ensureFolderExists(folder, projectRootId, accessToken);
        }

        return { projectRootId, subfolders: ids };
    },

    async exportPdf(fileId: string, accessToken?: string): Promise<{ buffer: Buffer }> {
        const service = getService(accessToken);
        const res = await service.files.export({
            fileId: fileId,
            mimeType: 'application/pdf',
        }, { responseType: 'arraybuffer' });

        return { buffer: Buffer.from(res.data) };
    }
};
