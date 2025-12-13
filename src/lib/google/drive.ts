import 'server-only';
import { google } from 'googleapis';
import { drive_v3 } from '@googleapis/drive'; // Needed for types/instantiation
import { GoogleAuth, JWT } from 'google-auth-library';

// Shared Auth Client Cache
let _authClient: any = null;
let _driveService: any = null;

// --- CENTRAL AUTH FACTORY ---
const getAuthClient = async (accessToken?: string) => {
    // 1. If Access Token provided (User Context), return ephemeral OAuth2 client
    if (accessToken) {
        const oauth2 = new google.auth.OAuth2();
        oauth2.setCredentials({ access_token: accessToken });
        return oauth2;
    }

    // 2. If Service Account (Server Context), use cached JWT/GoogleAuth
    if (_authClient) return _authClient;

    console.log("⚙️ [drive.ts] Initializing Server Auth Client...");

    const saKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY || process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    if (saKey) {
        try {
            const credentials = JSON.parse(saKey);

            const jwtClient = new JWT(
                credentials.client_email,
                undefined,
                credentials.private_key.replace(/\\n/g, '\n'),
                [
                    'https://www.googleapis.com/auth/drive',
                    'https://www.googleapis.com/auth/documents', // Added for Docs support
                    'https://www.googleapis.com/auth/spreadsheets' // Future proof
                ]
            );

            // VERIFY AUTH IMMEDIATELY
            await jwtClient.authorize();
            console.log(`✅ [drive.ts] JWT Auth Verified for: ${credentials.client_email}`);

            _authClient = jwtClient;
            return _authClient;

        } catch (e) {
            console.error("❌ [drive.ts] Service Account JWT Init Failed:", e);
        }
    }

    // Fallback to ADC
    console.log("⚠️ [drive.ts] Falling back to default GoogleAuth...");
    try {
        const auth = new GoogleAuth({
            scopes: ['https://www.googleapis.com/auth/drive', 'https://www.googleapis.com/auth/documents']
        });
        _authClient = auth; // GoogleAuth is an auth client factory but can be passed to google APIs
        return _authClient;
    } catch (e: any) {
        console.error("❌ [drive.ts] ADC Auth Failed:", e.message);
        throw new Error("Failed to initialize Google Auth");
    }
};

const getService = async (accessToken?: string) => {
    // If specific access token, always new instance
    if (accessToken) {
        const auth = await getAuthClient(accessToken);
        return google.drive({ version: 'v3', auth: auth as any });
    }

    // If cached service exists and no custom token, return it
    if (_driveService) return _driveService;

    // Initialize Service Account Drive
    const auth = await getAuthClient();
    _driveService = google.drive({ version: 'v3', auth: auth });
    return _driveService;
};

export const GoogleDriveService = {
    async ensureFolderExists(folderName: string, parentId?: string, accessToken?: string): Promise<string> {
        const service = await getService(accessToken);
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
        const service = await getService(accessToken);

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
        const service = await getService(accessToken);

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
        const service = await getService(accessToken);
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
        // CORRECTED: Use shared Auth Client (fixes 401 on Service Account)
        const auth = await getAuthClient(accessToken);
        const docs = google.docs({ version: 'v1', auth: auth as any });

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
        const service = await getService(accessToken);
        const res = await service.files.export({
            fileId: fileId,
            mimeType: 'application/pdf',
        }, { responseType: 'arraybuffer' });

        return { buffer: Buffer.from(res.data) };
    }
};
