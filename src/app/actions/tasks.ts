'use server';

import { GoogleTasksService } from '@/lib/google/tasks';
import { revalidatePath } from 'next/cache';

// Action to sync a checklist to Google Tasks
// If projectTitle is provided, tries to find/create a specific list, otherwise uses "ByggPilot Tasks"
export async function syncChecklistAction(title: string, items: string[], projectTitle?: string, accessToken?: string) {
    try {
        const listTitle = projectTitle ? `ByggPilot - ${projectTitle}` : "ByggPilot Tasks";
        const taskListId = await GoogleTasksService.ensureTaskList(listTitle, accessToken);

        // Create Parent Task (The Checklist Title)
        const parentTask = await GoogleTasksService.createTask(taskListId, title, `Importerad från ByggPilot Chat\n${new Date().toLocaleString()}`, accessToken);

        // We can't create subtasks easily via API in one go without parent pointers, 
        // but typically "Tasks" are flat or have 1 level of hierarchy.
        // For simplicity, we create individual tasks for now, OR we assume Google Tasks API 'parent' field usage.
        // Let's just create them as individual tasks for now to ensure visibility.
        // UPDATE: The user wants a "Checklist". Creating individual tasks in the list is better UX than one task with text.

        const results = [];
        for (const item of items) {
            // Optional: Make them subtasks if we want, but flat is safer for widgets
            await GoogleTasksService.createTask(taskListId, `${item} (${title})`, undefined, accessToken);
        }

        revalidatePath('/');
        return { success: true, message: `Checklista synkad till listan "${listTitle}"` };
    } catch (error: any) {
        console.error("Task Sync Failed:", error);
        return { success: false, message: error.message };
    }
}

export async function getTasksAction(accessToken?: string) {
    try {
        // Just fetch "ByggPilot Tasks" or the first list for the widget
        // Implementation refinement: Fetch ALL lists that start with "ByggPilot"
        const lists = await GoogleTasksService.listTaskLists(accessToken);
        const byggPilotLists = lists.filter(l => l.title?.startsWith('ByggPilot'));

        let allTasks: any[] = [];
        for (const list of byggPilotLists) {
            const tasks = await GoogleTasksService.listTasks(list.id!, accessToken);
            if (tasks) {
                allTasks = [...allTasks, ...tasks.map(t => ({ ...t, listTitle: list.title }))];
            }
        }

        return { success: true, tasks: allTasks };
    } catch (error: any) {
        return { success: false, tasks: [], error: error.message };
    }
}
