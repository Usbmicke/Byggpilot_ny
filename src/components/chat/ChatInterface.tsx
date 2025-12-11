'use client';

import { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { chatAction, approveChangeOrderAction } from '@/app/actions';
import { processVoiceCommandAction } from '@/app/actions/voice';
import { useAuth } from '@/components/AuthProvider';
import { useSearchParams, useRouter } from 'next/navigation';
import { Mic, Square, Send, X, MessageSquare, FileText, Check, Ban, ChevronUp, ChevronDown, Sparkles } from 'lucide-react';

interface Message {
    role: 'user' | 'model' | 'system';
    content: string;
    draft?: any; // For ÄTA Drafts
}

export default function ChatInterface() {
    const { user } = useAuth();
    const [isExpanded, setIsExpanded] = useState(false); // Controls if history is visible due to interaction
    const [messages, setMessages] = useState<Message[]>([]);

    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isRecording, setIsRecording] = useState(false);

    // Auto-expand when typing or recording
    useEffect(() => {
        if ((input.length > 0 || isRecording) && !isExpanded) {
            setIsExpanded(true);
        }
    }, [input, isRecording]);

    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        if (isExpanded) scrollToBottom();
    }, [messages, isExpanded]);

    // ... voice functions ...
    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const recorder = new MediaRecorder(stream);
            mediaRecorderRef.current = recorder;
            audioChunksRef.current = [];

            recorder.ondataavailable = (event) => {
                if (event.data.size > 0) audioChunksRef.current.push(event.data);
            };

            recorder.onstop = async () => {
                const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
                await handleVoiceSend(audioBlob);
                stream.getTracks().forEach(track => track.stop());
            };

            recorder.start();
            setIsRecording(true);
            setIsExpanded(true); // Ensure expanded on record
        } catch (err) {
            console.error("Mic access denied", err);
            alert("Kunde inte starta mikrofonen.");
        }
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.stop();
            setIsRecording(false);
        }
    };

    const handleVoiceSend = async (audioBlob: Blob) => {
        setIsLoading(true);
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = async () => {
            const base64Audio = reader.result as string;
            setMessages(prev => [...prev, { role: 'user', content: '🎤 Spelar in röstkommando...' }]);
            try {
                const projectId = 'demo-project-id';
                const result = await processVoiceCommandAction(projectId, { audioBase64: base64Audio });
                if (result.success) {
                    if (result.intent === 'create_ata' && result.draft) {
                        setMessages(prev => [...prev, { role: 'model', content: result.reply || '', draft: result.draft }]);
                    } else {
                        setMessages(prev => [...prev, { role: 'model', content: result.reply || '' }]);
                    }
                } else {
                    setMessages(prev => [...prev, { role: 'model', content: 'Kunde inte tolka ljudet.' }]);
                }
            } catch (e) {
                setMessages(prev => [...prev, { role: 'model', content: 'Ett fel uppstod.' }]);
            } finally {
                setIsLoading(false);
            }
        };
    };

    const handleApproval = async (draftId: string, approved: boolean) => {
        setMessages(prev => prev.map(msg => {
            if (msg.draft && msg.draft.id === draftId) {
                return { ...msg, draft: null, content: approved ? `${msg.content}\n\n✅ **ÄTA Godkänd**` : `${msg.content}\n\n🚫 **ÄTA Avvisad**` };
            }
            return msg;
        }));
        await approveChangeOrderAction(draftId, approved);
    };

    const handleSend = async (arg?: string | React.MouseEvent | React.KeyboardEvent) => {
        const textToSend = typeof arg === 'string' ? arg : input;
        if (!textToSend.trim()) return;

        const userMsg: Message = { role: 'user', content: textToSend };
        const newHistory = [...messages, userMsg];
        setMessages(newHistory);
        setInput('');
        setIsLoading(true);
        setIsExpanded(true); // Ensure stays open
        try {
            const accessToken = localStorage.getItem('google_access_token') || undefined;
            const result = await chatAction(newHistory, user?.uid, accessToken);
            if (!result.success) throw new Error(result.error);
            setMessages((prev) => [...prev, { role: 'model', content: result.text || '' }]);
        } catch (error) {
            setMessages((prev) => [...prev, { role: 'model', content: 'Ursäkta, något gick fel.' }]);
        } finally {
            setIsLoading(false);
        }
    };

    // Auto-Prompt from URL
    const searchParams = useSearchParams();
    const router = useRouter();

    useEffect(() => {
        const query = searchParams.get('chatQuery');
        if (query && !isLoading) {
            handleSend(query);
            // Clear param to avoid re-trigger
            const params = new URLSearchParams(searchParams.toString());
            params.delete('chatQuery');
            router.replace(`?${params.toString()}`);
        }
    }, [searchParams]);

    return (
        <div className={`fixed bottom-0 right-0 left-0 md:left-64 z-50 flex flex-col justify-end font-sans`}>

            {/* Backdrop (Only when expanded) - Use z-40 to be behind panels but above content */}
            {isExpanded && (
                <div
                    className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 transition-opacity"
                    onClick={() => setIsExpanded(false)}
                />
            )}

            {/* Chat Panel (History) - Expands UP to Header (h-16 = 64px) */}
            {/* Using fixed positioning to guarantee full screen coverage (minus header/side) */}
            <div className={`fixed top-16 bottom-24 left-4 right-4 md:left-[17rem] md:right-4 bg-zinc-900/95 border border-zinc-700/50 backdrop-blur-2xl shadow-2xl rounded-3xl overflow-hidden flex flex-col transition-all duration-500 transform origin-bottom z-50 ${isExpanded ? 'translate-y-0 opacity-100 scale-100' : 'translate-y-20 opacity-0 scale-95 pointer-events-none'}`}>

                {/* Header */}
                <div className="p-4 border-b border-zinc-800/50 flex items-center justify-between bg-zinc-900/50">
                    <div className="flex items-center gap-2 text-zinc-100">
                        <div className="bg-primary/10 p-1.5 rounded-lg">
                            <Sparkles size={16} className="text-primary" />
                        </div>
                        <span className="font-semibold text-sm tracking-wide">ByggPilot AI</span>
                    </div>
                    <button onClick={() => setIsExpanded(false)} className="p-2 hover:bg-zinc-800 rounded-full text-zinc-500 hover:text-zinc-300 transition-colors">
                        <ChevronDown size={18} />
                    </button>
                </div>

                {/* Messages Area */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6 scroll-smooth">
                    {messages.length === 0 && (
                        <div className="h-full flex flex-col items-center justify-center text-zinc-500 space-y-4 opacity-50">
                            <Sparkles size={48} strokeWidth={1} />
                            <p className="text-sm font-medium">Jag är redo att hjälpa dig.</p>
                        </div>
                    )}

                    {messages.map((m, idx) => (
                        <div key={idx} className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'}`}>
                            {/* Message Bubble */}
                            <div className={`max-w-[85%] rounded-2xl px-5 py-3.5 text-sm shadow-sm leading-relaxed ${m.role === 'user'
                                ? 'bg-zinc-800 text-white rounded-br-sm border border-zinc-700'
                                : 'bg-transparent text-zinc-200 pl-0'
                                }`}>
                                {m.role === 'model'
                                    ? <div className="prose prose-invert prose-sm max-w-none prose-p:text-zinc-300"><ReactMarkdown>{m.content}</ReactMarkdown></div>
                                    : m.content}
                            </div>
                            {/* ÄTA Draft Rendering logic... */}
                            {m.draft && (
                                <div className="mt-2 w-[90%] bg-zinc-900 border border-amber-900/40 rounded-xl p-4 shadow-lg">
                                    <div className="flex items-center gap-2 mb-3 text-amber-500 font-medium text-xs uppercase tracking-wider">
                                        <FileText size={14} /> <span>Utkast: ÄTA</span>
                                    </div>
                                    <div className="space-y-2 text-sm text-zinc-300 mb-4 font-mono bg-black/20 p-3 rounded-lg">
                                        <p>{m.draft.description}</p>
                                        <p className="text-right font-bold">{m.draft.estimatedCost} kr</p>
                                    </div>
                                    <div className="flex gap-2">
                                        <button onClick={() => handleApproval(m.draft.id, true)} className="flex-1 bg-emerald-900/20 text-emerald-500 border border-emerald-900/50 py-2 rounded-lg text-xs font-bold hover:bg-emerald-900/40 transition-colors">Godkänn</button>
                                        <button onClick={() => handleApproval(m.draft.id, false)} className="flex-1 bg-zinc-800 text-zinc-400 border border-zinc-700 py-2 rounded-lg text-xs font-bold hover:bg-zinc-700 transition-colors">Avböj</button>
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}
                    {isLoading && <div className="text-zinc-500 text-xs font-medium animate-pulse ml-2 flex items-center gap-2">
                        <span className="w-1.5 h-1.5 bg-zinc-500 rounded-full animate-bounce"></span>
                        <span className="w-1.5 h-1.5 bg-zinc-500 rounded-full animate-bounce delay-75"></span>
                        <span className="w-1.5 h-1.5 bg-zinc-500 rounded-full animate-bounce delay-150"></span>
                    </div>}
                    <div ref={messagesEndRef} />
                </div>
            </div>

            {/* Input Bar (Always Visible) */}
            <div className="h-24 bg-zinc-950/80 backdrop-blur-md border-t border-zinc-800/50 px-4 md:px-6 flex items-center justify-center relative z-50">

                {/* Full Width Container */}
                <div className="w-full relative group">
                    {/* Glow Effect */}
                    <div className="absolute inset-x-0 bottom-0 top-0 bg-gradient-to-r from-zinc-800 via-zinc-700 to-zinc-800 rounded-full blur opacity-10 group-hover:opacity-20 transition-opacity"></div>

                    {/* Main Input Container */}
                    <div className="relative bg-zinc-900 rounded-full border border-zinc-700/50 flex items-center p-2 shadow-lg hover:border-zinc-600 focus-within:border-zinc-500 focus-within:ring-1 focus-within:ring-zinc-500/50 transition-all">

                        {/* Expand Toggle (Left) */}
                        <button
                            onClick={() => setIsExpanded(!isExpanded)}
                            className={`p-3 rounded-full transition-all duration-300 ${isExpanded ? 'bg-zinc-800 text-zinc-200 rotate-180' : 'bg-transparent text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800'}`}
                            title={isExpanded ? "Dölj" : "Visa"}
                        >
                            <ChevronUp size={20} />
                        </button>

                        <div className="h-6 w-[1px] bg-zinc-800 mx-2"></div>

                        {/* Input Field */}
                        <input
                            type="text"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter') handleSend(); }}
                            onFocus={() => setIsExpanded(true)}
                            placeholder="Fråga ByggPilot AI..."
                            className="flex-1 bg-transparent border-none focus:ring-0 text-zinc-200 placeholder:text-zinc-500 font-medium px-2 outline-none"
                        />

                        {/* Right Actions */}
                        <div className="flex items-center gap-1 pl-2">
                            <button
                                onClick={isRecording ? stopRecording : startRecording}
                                className={`p-3 rounded-full transition-all ${isRecording ? 'bg-red-500/10 text-red-500 animate-pulse' : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'}`}
                            >
                                {isRecording ? <Square size={18} fill="currentColor" /> : <Mic size={18} />}
                            </button>
                            <button
                                onClick={handleSend}
                                disabled={!input.trim() || isLoading}
                                className={`p-3 rounded-full transition-all ${input.trim() ? 'bg-zinc-100 text-zinc-900 shadow-md hover:scale-105' : 'bg-zinc-800 text-zinc-500 cursor-not-allowed'}`}
                            >
                                <Send size={18} className={input.trim() ? 'ml-0.5' : ''} />
                            </button>
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
}
