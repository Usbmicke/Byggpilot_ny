import 'server-only';
import { db } from './server';

export interface ProjectData {
    id: string;
    name: string;
    status: 'active' | 'completed' | 'archived';
    createdAt: FirebaseFirestore.Timestamp;
    ownerId: string;
}

const COLLECTION = 'projects';

export const ProjectRepo = {
    async listByOwner(ownerId: string): Promise<ProjectData[]> {
        const snapshot = await db
            .collection(COLLECTION)
            .where('ownerId', '==', ownerId)
            .get();

        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ProjectData));
    },

    async create(data: Omit<ProjectData, 'id' | 'createdAt'>) {
        const docRef = db.collection(COLLECTION).doc();
        const newProject: ProjectData = {
            id: docRef.id,
            ...data,
            createdAt: db.Timestamp.now() as any,
        };
        await docRef.set(newProject);
        return newProject;
    }
};
