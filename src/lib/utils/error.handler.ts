/**
 * Centralized Error Handling Service.
 * In a real M&A context, this would stream logs to Sentry/Datadog.
 * For now, it provides a standardized way to log critical failures.
 */

export const ErrorHandler = {
    /**
     * Log a critical error that requires developer attention.
     */
    captureException(error: any, context?: Record<string, any>) {
        console.error(`💥 [CRITICAL ERROR]`, {
            message: error.message || 'Unknown Error',
            stack: error.stack,
            context,
            timestamp: new Date().toISOString()
        });

        // Future: Sentry.captureException(error, { extra: context });
    },

    /**
     * Log a warning (expected failure, validation error).
     */
    warn(message: string, context?: Record<string, any>) {
        console.warn(`⚠️ [WARNING] ${message}`, context);
    }
};
