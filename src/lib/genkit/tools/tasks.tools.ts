import 'server-only';
import { z } from 'genkit';
import { ai } from '@/lib/genkit-instance';
import { GoogleTasksService } from '@/lib/google/tasks';

export const createTaskTool = ai.defineTool(
    {
        name: 'createTask',
        description: 'Creates a new Task in Google Tasks. Use this when user wants to "remember" something or adds an item to a checklist.',
        inputSchema: z.object({
            title: z.string().describe('The task title'),
            notes: z.string().optional().describe('Details or context'),
            projectTitle: z.string().optional().describe('Project name to group tasks (creates "ByggPilot - [Project]" list). Default: "ByggPilot Tasks"')
        }),
        outputSchema: z.object({
            success: z.boolean(),
            taskId: z.string(),
            listTitle: z.string(),
            message: z.string()
        }),
    },
    async (input, context: any) => {
        try {
            console.log(`📝 Tool: createTask "${input.title}"`);
            const accessToken = context?.accessToken || context?.context?.accessToken;

            const listTitle = input.projectTitle ? `ByggPilot - ${input.projectTitle}` : "ByggPilot Tasks";
            const taskListId = await GoogleTasksService.ensureTaskList(listTitle, accessToken);

            const task = await GoogleTasksService.createTask(
                taskListId,
                input.title,
                input.notes ? `${input.notes}\n(Via AI)` : '(Via AI)',
                accessToken
            );

            return {
                success: true,
                taskId: task.id!,
                listTitle: listTitle,
                message: `Uppgift skapad i listan "${listTitle}": ${input.title}`
            };
        } catch (e: any) {
            console.error("Task Creation Failed:", e);
            return { success: false, taskId: '', listTitle: '', message: e.message };
        }
    }
);

export const listTasksTool = ai.defineTool(
    {
        name: 'listTasks',
        description: 'Lists active tasks from Google Tasks (Searches all "ByggPilot" lists).',
        inputSchema: z.object({}),
        outputSchema: z.string(),
    },
    async (input, context: any) => {
        try {
            console.log(`📋 Tool: listTasks`);
            const accessToken = context?.accessToken || context?.context?.accessToken;

            // Fetch all lists stating with "ByggPilot"
            const allLists = await GoogleTasksService.listTaskLists(accessToken);
            const targetLists = allLists.filter(l => l.title?.startsWith('ByggPilot'));

            let report = "MINA UPPGIFTER (Google Tasks):\n";
            let count = 0;

            for (const list of targetLists) {
                if (!list.id) continue;
                const tasks = await GoogleTasksService.listTasks(list.id, accessToken);
                if (tasks.length > 0) {
                    report += `\n📂 LISTA: ${list.title} (ID: ${list.id})\n`;
                    tasks.forEach(t => {
                        report += `  - [ ] ${t.title} (ID: ${t.id})\n`;
                        count++;
                    });
                }
            }

            if (count === 0) return "Inga öppna uppgifter hittades.";
            return report;

        } catch (e: any) {
            console.error("List Tasks Failed:", e);
            return `Error listing tasks: ${e.message}`;
        }
    }
);

export const completeTaskTool = ai.defineTool(
    {
        name: 'completeTask',
        description: 'Marks a Google Task as completed.',
        inputSchema: z.object({
            taskId: z.string().describe('The ID of the task to complete'),
            taskListId: z.string().describe('The ID of the list the task belongs to (Required found via listTasks)')
        }),
        outputSchema: z.string(),
    },
    async (input, context: any) => {
        try {
            console.log(`✅ Tool: completeTask ${input.taskId}`);
            const accessToken = context?.accessToken || context?.context?.accessToken;

            await GoogleTasksService.updateTaskStatus(input.taskListId, input.taskId, 'completed', accessToken);
            return "Uppgiften är nu markerad som klar! ✅";
        } catch (e: any) {
            return `Failed to complete task: ${e.message}`;
        }
    }
);
