'use client';

import { useState, useRef, useEffect } from 'react';
import { useGenkit } from '@/hooks/useGenkit';
import ReactMarkdown from 'react-markdown'; // Ensure this is installed

interface Message {
    role: 'user' | 'model' | 'system';
    content: string;
}

export default function ChatInterface() {
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // useGenkit hook for the 'chatFlow'
    // Note: Standard SWR/fetcher doesn't support streaming easily without custom logic.
    // For MVP "Streaming UI" (requested in vigtigt.md), we might fake it or fetch full text for now 
    // until we upgrade the hook to support ReadableStream. 
    // Given instructions: "Implementera frontend-logik för att rendera texten ord-för-ord ('skrivmaskinseffekt')."
    // If the backend returns full text, we can simulate typewriter effect here.
    const { runFlow, isLoading } = useGenkit<any, string>('chatFlow');

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const handleSend = async () => {
        if (!input.trim()) return;

        const userMsg: Message = { role: 'user', content: input };
        setMessages((prev) => [...prev, userMsg]);
        setInput('');

        try {
            // Call Genkit Flow
            // Pass history? 
            // The flow expects { messages: [] }
            const responseText = await runFlow({
                messages: [...messages, userMsg]
            });

            // Typewriter effect simulation since we might get full text at once for now
            const modelMsg: Message = { role: 'model', content: '' };
            setMessages((prev) => [...prev, modelMsg]);

            // Simple typewriter logic
            let i = 0;
            const interval = setInterval(() => {
                setMessages((prev) => {
                    const newHistory = [...prev];
                    const lastMsg = newHistory[newHistory.length - 1];
                    if (lastMsg.role === 'model') {
                        lastMsg.content = responseText.slice(0, i + 1);
                    }
                    return newHistory;
                });
                i++;
                if (i === responseText.length) clearInterval(interval);
            }, 10); // Adjust speed

        } catch (error) {
            console.error(error);
            setMessages((prev) => [...prev, { role: 'model', content: 'Ursäkta, något gick fel. Försök igen.' }]);
        }
    };

    return (
        <>
            {/* Toggle Button */}
            {!isOpen && (
                <button
                    onClick={() => setIsOpen(true)}
                    className="fixed bottom-6 right-6 h-14 w-14 bg-indigo-600 rounded-full shadow-lg flex items-center justify-center text-white hover:bg-indigo-700 transition-all z-50 text-2xl"
                >
                    ✨
                </button>
            )}

            {/* Chat Sideboard */}
            <div
                className={`fixed inset-y-0 right-0 w-96 bg-white shadow-2xl transform transition-transform duration-300 ease-in-out z-50 flex flex-col ${isOpen ? 'translate-x-0' : 'translate-x-full'
                    }`}
            >
                {/* Header */}
                <div className="p-4 border-b border-gray-200 flex items-center justify-between bg-indigo-600 text-white">
                    <h3 className="font-semibold">ByggPilot Co-Pilot</h3>
                    <button onClick={() => setIsOpen(false)} className="text-indigo-100 hover:text-white">
                        ✕
                    </button>
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
                    {messages.length === 0 && (
                        <div className="text-center text-gray-400 mt-10 text-sm">
                            Jag kan hjälpa dig skapa projekt, beräkna offerter eller svara på frågor.
                        </div>
                    )}
                    {messages.map((m, idx) => (
                        <div
                            key={idx}
                            className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
                        >
                            <div
                                className={`max-w-[85%] rounded-lg p-3 text-sm ${m.role === 'user'
                                        ? 'bg-indigo-600 text-white rounded-br-none'
                                        : 'bg-white text-gray-800 shadow-sm border border-gray-100 rounded-bl-none'
                                    }`}
                            >
                                {m.role === 'model' ? (
                                    <div className="prose prose-sm max-w-none">
                                        <ReactMarkdown>{m.content}</ReactMarkdown>
                                    </div>
                                ) : (
                                    m.content
                                )}
                            </div>
                        </div>
                    ))}
                    {isLoading && (
                        <div className="flex justify-start">
                            <div className="bg-white p-3 rounded-lg border shadow-sm text-gray-400 text-sm">
                                Tänker...
                            </div>
                        </div>
                    )}
                    <div ref={messagesEndRef} />
                </div>

                {/* Input */}
                <div className="p-4 bg-white border-t border-gray-200">
                    <div className="flex gap-2">
                        <input
                            type="text"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                            placeholder="Vad vill du göra?"
                            className="flex-1 border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500 text-sm p-2 border"
                            disabled={isLoading}
                            autoFocus
                        />
                        <button
                            onClick={handleSend}
                            disabled={isLoading || !input.trim()}
                            className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 disabled:opacity-50"
                        >
                            🚀
                        </button>
                    </div>
                </div>
            </div>
        </>
    );
}
