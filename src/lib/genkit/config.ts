export const AI_MODELS = {
    // Updated to latest (Jan 2026): 'gemini-3.0-pro'
    SMART: 'googleai/gemini-3.0-pro',
    // Updated to latest: 'gemini-3.0-flash'
    FAST: 'googleai/gemini-3.0-flash',
    EMBEDDING: 'googleai/text-embedding-004',
    MOCK: 'mock-free'
};

export const AI_CONFIG = {
    temperature: {
        creative: 0.7,
        precise: 0.2, // Low temp for extraction/logic
        balanced: 0.5
    }
};
