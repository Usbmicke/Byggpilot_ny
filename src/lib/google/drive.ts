import 'server-only';
import { drive } from '@googleapis/drive'; // Updated import based on package
import { GoogleAuth } from 'google-auth-library';

// Lazy init to prevent ADC crash on load if env vars are missing
let _service: any = null;

const getService = () => {
    if (!_service) {
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
            } catch (e) {
                console.error("❌ [drive.ts] Failed to parse Service Account for Drive:", e);
            }
        }

        const auth = new GoogleAuth(authOptions);
        _service = drive({ version: 'v3', auth: auth as any });
    }
    return _service;
};

export const GoogleDriveService = {
    async ensureFolderExists(folderName: string, parentId?: string): Promise<string> {
        const service = getService();
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

    async createProjectFolder(projectName: string, companyFolderId: string) {
        return this.ensureFolderExists(projectName, companyFolderId);
    },

    async uploadFile(name: string, mimeType: string, body: any, parentId?: string): Promise<{ id: string, webViewLink: string }> {
        const service = getService();

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

    // --- ISO OFFICE STRUCTURE ---

    async ensureRootStructure(companyName: string) {
        // 1. Root Folder: "ByggPilot - [Company]"
        const rootName = `ByggPilot - ${companyName}`;
        const rootId = await this.ensureFolderExists(rootName);

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
            folderIds[folder] = await this.ensureFolderExists(folder, rootId);
        }

        // 3. Bokföring sub-structure
        const accountingId = folderIds['05_Bokföringsunderlag'];
        const currentYear = new Date().getFullYear().toString();
        const yearId = await this.ensureFolderExists(currentYear, accountingId);
        await this.ensureFolderExists('Q1_Kvitton', yearId);
        await this.ensureFolderExists('Q2_Kvitton', yearId);
        await this.ensureFolderExists('Q3_Kvitton', yearId);
        await this.ensureFolderExists('Q4_Kvitton', yearId);

        return { rootId, folders: folderIds };
    },

    async createProjectStructure(projectName: string, projectsRootId: string) {
        // 1. Create Project Root inside "02_Pågående Projekt"
        const projectRootId = await this.ensureFolderExists(projectName, projectsRootId);

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
            ids[folder] = await this.ensureFolderExists(folder, projectRootId);
        }

        return { projectRootId, subfolders: ids };
    }
};
