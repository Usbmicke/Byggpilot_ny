import 'server-only';
import { google } from 'googleapis';
import { getAuthClient } from './drive'; // Re-using shareable auth factory

export const GoogleTasksService = {
    async getService(accessToken?: string) {
        const auth = await getAuthClient(accessToken);
        return google.tasks({ version: 'v1', auth: auth as any });
    },

    async listTaskLists(accessToken?: string) {
        const service = await this.getService(accessToken);
        const res = await service.tasklists.list();
        return res.data.items || [];
    },

    async ensureTaskList(title: string, accessToken?: string) {
        const lists = await this.listTaskLists(accessToken);
        const existing = lists.find(l => l.title?.toLowerCase() === title.toLowerCase());
        if (existing) return existing.id!;

        const service = await this.getService(accessToken);
        const res = await service.tasklists.insert({
            requestBody: { title }
        });
        return res.data.id!;
    },

    async createTask(taskListId: string, title: string, notes?: string, accessToken?: string) {
        const service = await this.getService(accessToken);
        const res = await service.tasks.insert({
            tasklist: taskListId,
            requestBody: {
                title,
                notes,
                status: 'needsAction'
            }
        });
        return res.data;
    },

    async listTasks(taskListId: string, accessToken?: string) {
        const service = await this.getService(accessToken);
        const res = await service.tasks.list({
            tasklist: taskListId,
            showCompleted: false,
            showHidden: false
        });
        return res.data.items || [];
    },

    async updateTaskStatus(taskListId: string, taskId: string, status: 'needsAction' | 'completed', accessToken?: string) {
        const service = await this.getService(accessToken);
        await service.tasks.update({
            tasklist: taskListId,
            task: taskId,
            requestBody: {
                id: taskId,
                status
            }
        });
    },

    async deleteTask(taskListId: string, taskId: string, accessToken?: string) {
        const service = await this.getService(accessToken);
        await service.tasks.delete({
            tasklist: taskListId,
            task: taskId
        });
    }
};
