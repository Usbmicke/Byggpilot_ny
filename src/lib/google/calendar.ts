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
    }
};
