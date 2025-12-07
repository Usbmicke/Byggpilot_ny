import 'server-only';
import { drive } from '@googleapis/drive'; // Updated import based on package
import { GoogleAuth } from 'google-auth-library';

// Lazy init to prevent ADC crash on load if env vars are missing
let _service: any = null;

const getService = () => {
    if (!_service) {
        const auth = new GoogleAuth({
            scopes: ['https://www.googleapis.com/auth/drive'],
        });
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
    }
};
