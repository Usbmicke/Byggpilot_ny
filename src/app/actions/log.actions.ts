'use server';

import { LogRepo } from '@/lib/dal/log.repo';
import { ProjectRepo } from '@/lib/dal/project.repo';

export async function logWorkAction(data: { projectId: string; userId: string; type: 'time' | 'mileage'; amount: number; description?: string; date?: string }) {
    try {
        if (!data.projectId || !data.userId || !data.amount) {
            throw new Error('Missing required fields');
        }

        // Verify project exists
        const project = await ProjectRepo.get(data.projectId);
        if (!project) throw new Error('Project not found');

        const log = await LogRepo.create({
            projectId: data.projectId,
            userId: data.userId,
            type: data.type,
            amount: Number(data.amount),
            description: data.description,
            date: data.date ? new Date(data.date) : new Date()
        });

        // Convert Dates for Client
        return {
            success: true,
            log: {
                ...log,
                date: log.date.toDate().toISOString(),
                createdAt: log.createdAt.toDate().toISOString()
            }
        };

    } catch (error: any) {
        console.error('❌ Log Work Failed:', error);
        return { success: false, error: error.message };
    }
}

export async function getRecentLogsAction(userId: string) {
    try {
        const logs = await LogRepo.listRecentByUser(userId);
        // Convert Dates for Client
        const plainLogs = logs.map(l => ({
            ...l,
            date: l.date.toDate().toISOString(),
            createdAt: l.createdAt.toDate().toISOString()
        }));
        return { success: true, logs: plainLogs };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}
