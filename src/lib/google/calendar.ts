import 'server-only';
import { google } from 'googleapis';

export const CalendarService = {
    async createEvent(accessToken: string, eventData: { summary: string; description: string; startTime: string; endTime: string }) {
        const auth = new google.auth.OAuth2();
        auth.setCredentials({ access_token: accessToken });

        const calendar = google.calendar({ version: 'v3', auth });

        const event = {
            summary: eventData.summary,
            description: eventData.description,
            start: {
                dateTime: eventData.startTime, // ISO string
                timeZone: 'Europe/Stockholm',
            },
            end: {
                dateTime: eventData.endTime,
                timeZone: 'Europe/Stockholm',
            },
        };

        const response = await calendar.events.insert({
            calendarId: 'primary',
            requestBody: event,
        });

        return response.data;
    },

    async listEvents(accessToken: string, timeMin: string, timeMax: string) {
        console.log(`🔍 CalendarService.listEvents (All Calendars) min=${timeMin} max=${timeMax}`);
        const auth = new google.auth.OAuth2();
        auth.setCredentials({ access_token: accessToken });

        const calendar = google.calendar({ version: 'v3', auth });

        try {
            // 1. Get List of Calendars
            const calList = await calendar.calendarList.list({ minAccessRole: 'reader' });
            const calendars = calList.data.items || [];
            console.log(`📅 Found ${calendars.length} calendars to check.`);

            // 2. Query all calendars in parallel
            const promises = calendars.map(async (cal) => {
                if (!cal.id) return [];
                try {
                    const res = await calendar.events.list({
                        calendarId: cal.id,
                        timeMin: timeMin,
                        timeMax: timeMax,
                        singleEvents: true,
                        orderBy: 'startTime',
                    });
                    const events = res.data.items || [];
                    if (events.length > 0) {
                        console.log(`✅ Found ${events.length} events in calendar: ${cal.summary}`);
                    }
                    // Attach calendar name to event for context
                    return events.map(e => ({ ...e, calendarName: cal.summary }));
                } catch (err) {
                    console.warn(`⚠️ Failed to list events for calendar ${cal.summary} (${cal.id})`, err);
                    return [];
                }
            });

            const results = await Promise.all(promises);
            const allEvents = results.flat();

            console.log(`✅ Total events found across all calendars: ${allEvents.length}`);
            return allEvents;

        } catch (error: any) {
            console.error("❌ Failed to list calendar events (General Error):", error.message);
            throw error;
        }
    }
};
