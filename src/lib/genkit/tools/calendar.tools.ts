import 'server-only';
import { ai } from '@/lib/genkit-instance';
import { z } from 'genkit';
import { CalendarService } from '@/lib/google/calendar';

export const checkAvailabilityTool = ai.defineTool(
    {
        name: 'checkAvailability',
        description: 'Check for calendar conflicts before booking an event. Returns a list of conflicting events.',
        inputSchema: z.object({
            startTime: z.string().describe('ISO string of the start time'),
            endTime: z.string().describe('ISO string of the end time'),
        }),
        outputSchema: z.object({
            available: z.boolean(),
            conflicts: z.array(z.object({
                summary: z.string().optional(),
                start: z.string().optional(),
                end: z.string().optional()
            })),
            error: z.string().optional()
        }),
    },
    async (input, context) => { // Context (accessToken) is required here
        const token = (context as any).context?.accessToken;

        if (!token) {
            return { available: false, conflicts: [], error: "Missing Google Access Token." };
        }

        console.log(`📅 checkAvailability: Checking from ${input.startTime} to ${input.endTime}`);

        // Validate Dates
        const start = new Date(input.startTime);
        const end = new Date(input.endTime);

        if (isNaN(start.getTime()) || isNaN(end.getTime())) {
            return { available: false, conflicts: [], error: `Invalid date format provided: ${input.startTime} - ${input.endTime}` };
        }

        // Ensure timeMin < timeMax (Google API Requirement)
        if (end <= start) {
            return { available: false, conflicts: [], error: `End time must be after start time.` };
        }

        const timeMin = start.toISOString();
        const timeMax = end.toISOString();

        console.log(`🕒 Timezone Debug: Input=${input.startTime} (${start.toString()}) -> ISO=${timeMin}`);

        try {
            const events = await CalendarService.listEvents(token, timeMin, timeMax);

            const conflicts = events.map((e: any) => ({
                summary: e.summary,
                start: e.start.dateTime || e.start.date,
                end: e.end.dateTime || e.end.date
            }));

            return {
                available: conflicts.length === 0,
                conflicts: conflicts,
                error: undefined
            };
        } catch (e: any) {
            return { available: false, conflicts: [], error: `Failed to check calendar: ${e.message}` };
        }
    }
);

export const bookMeetingTool = ai.defineTool(
    {
        name: 'bookMeeting',
        description: 'Books a meeting in the users calendar.',
        inputSchema: z.object({
            summary: z.string().describe('Title of the meeting'),
            description: z.string().optional().describe('Description or agenda'),
            startTime: z.string().describe('ISO string of start time'),
            endTime: z.string().describe('ISO string of end time'),
        }),
        outputSchema: z.object({
            success: z.boolean(),
            eventId: z.string().optional(),
            link: z.string().optional(),
            message: z.string()
        }),
    },
    async (input, context) => {
        const token = (context as any).context?.accessToken;
        if (!token) return { success: false, eventId: undefined, link: undefined, message: "Saknar behörighet (Google Token)." };

        try {
            console.log(`📅 Booking Meeting: ${input.summary} @ ${input.startTime}`);
            const event = await CalendarService.createEvent(token, {
                summary: input.summary,
                description: input.description || '',
                startTime: input.startTime,
                endTime: input.endTime
            });

            return {
                success: true,
                eventId: event.id || undefined,
                link: event.htmlLink || undefined,
                message: `Möte bokat! Länk: ${event.htmlLink}`
            };
        } catch (e: any) {
            console.error("Booking Failed", e);
            return { success: false, eventId: undefined, link: undefined, message: `Kunde inte boka möte: ${e.message}` };
        }
    }
);
