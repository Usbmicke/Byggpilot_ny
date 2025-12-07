export const AI_MODELS = {
    FAST: 'googleai/gemini-2.5-flash',
    SMART: 'googleai/gemini-2.5-flash', // Could be 'gemini-3-pro' later
    VISION: 'googleai/gemini-2.5-flash',
};

export const AI_CONFIG = {
    temperature: {
        creative: 0.7,
        precise: 0.2,
    },
    maxHistory: 10, // Max messages to keep in context
};
