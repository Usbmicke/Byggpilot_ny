'use client';

import { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { chatAction, approveChangeOrderAction } from '@/app/actions';
import { processVoiceCommandAction } from '@/app/actions/voice'; // We need to export/create this properly
import { Mic, Square, Send, X, MessageSquare, FileText, Check, Ban } from 'lucide-react';

interface Message {
    role: 'user' | 'model' | 'system';
    content: string;
    draft?: any; // For ÄTA Drafts
}

export default function ChatInterface() {
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isRecording, setIsRecording] = useState(false);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages, isOpen]);

    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const recorder = new MediaRecorder(stream);
            mediaRecorderRef.current = recorder;
            audioChunksRef.current = [];

            recorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    audioChunksRef.current.push(event.data);
                }
            };

            recorder.onstop = async () => {
                const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
                await handleVoiceSend(audioBlob);
                stream.getTracks().forEach(track => track.stop());
            };

            recorder.start();
            setIsRecording(true);
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

            // Add Optimistic User Message
            setMessages(prev => [...prev, { role: 'user', content: '🎤 Spelar in röstkommando...' }]);

            try {
                // TODO: Get real project ID from context/url or infer
                const projectId = 'demo-project-id';
                const result = await processVoiceCommandAction(projectId, { audioBase64: base64Audio });

                if (result.success) {
                    if (result.intent === 'create_ata' && result.draft) {
                        setMessages(prev => [...prev, {
                            role: 'model',
                            content: result.reply,
                            draft: result.draft
                        }]);
                    } else {
                        setMessages(prev => [...prev, { role: 'model', content: result.reply }]);
                    }
                } else {
                    setMessages(prev => [...prev, { role: 'model', content: 'Kunde inte tolka ljudet. Försök igen.' }]);
                }
            } catch (e) {
                console.error(e);
                setMessages(prev => [...prev, { role: 'model', content: 'Ett fel uppstod.' }]);
            } finally {
                setIsLoading(false);
            }
        };
    };

    const handleApproval = async (draftId: string, approved: boolean) => {
        setMessages(prev => prev.map(msg => {
            if (msg.draft && msg.draft.id === draftId) {
                return {
                    ...msg,
                    draft: null,
                    content: approved ? `${msg.content}\n\n✅ **ÄTA Godkänd**` : `${msg.content}\n\n🚫 **ÄTA Avvisad**`
                };
            }
            return msg;
        }));
        await approveChangeOrderAction(draftId, approved);
    };

    const handleSend = async () => {
        if (!input.trim()) return;

        const userMsg: Message = { role: 'user', content: input };
        const newHistory = [...messages, userMsg];
        setMessages(newHistory);
        setInput('');
        setIsLoading(true);

        try {
            const result = await chatAction(newHistory);
            if (!result.success || !result.text) throw new Error(result.error || 'No response text');

            setMessages((prev) => [...prev, { role: 'model', content: result.text }]);
        } catch (error) {
            console.error(error);
            setMessages((prev) => [...prev, { role: 'model', content: 'Ursäkta, något gick fel.' }]);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <>
            {/* Toggle Button */}
            {!isOpen && (
                <button
                    onClick={() => setIsOpen(true)}
                    className="fixed bottom-6 right-6 h-14 w-14 bg-indigo-600 rounded-full shadow-lg flex items-center justify-center text-white hover:bg-indigo-700 transition-all z-50 text-2xl animate-in fade-in zoom-in"
                >
                    <MessageSquare size={24} />
                </button>
            )}

            {/* Chat Sideboard */}
            <div
                className={`fixed inset-y-0 right-0 w-96 bg-card shadow-2xl transform transition-transform duration-300 ease-in-out z-50 flex flex-col border-l border-border ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}
            >
                {/* Header */}
                <div className="p-4 border-b border-border flex items-center justify-between bg-primary text-primary-foreground">
                    <h3 className="font-semibold flex items-center gap-2">
                        <span className="text-xl">👷</span> ByggPilot AI
                    </h3>
                    <button onClick={() => setIsOpen(false)} className="hover:text-white/80 transition-colors">
                        <X size={20} />
                    </button>
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-background">
                    {messages.length === 0 && (
                        <div className="text-center text-muted-foreground mt-10 text-sm">
                            <p>Hej! Jag kan hjälpa dig med:</p>
                            <ul className="mt-2 space-y-1">
                                <li>✨ Skapa ÄTA via röst</li>
                                <li>📄 Hitta dokument</li>
                                <li>🏗️ Skapa projekt</li>
                            </ul>
                        </div>
                    )}
                    {messages.map((m, idx) => (
                        <div key={idx} className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'}`}>
                            <div className={`max-w-[85%] rounded-lg p-3 text-sm shadow-sm ${m.role === 'user'
                                ? 'bg-primary text-primary-foreground rounded-br-none'
                                : 'bg-card text-card-foreground border border-border rounded-bl-none'
                                }`}>
                                {m.role === 'model' ? <ReactMarkdown>{m.content}</ReactMarkdown> : m.content}
                            </div>

                            {/* Draft Card for ÄTA */}
                            {m.draft && (
                                <div className="mt-2 w-[85%] bg-card border border-amber-500/30 rounded-lg p-4 shadow-md animate-in fade-in slide-in-from-bottom-2">
                                    <div className="flex items-center gap-2 mb-2 text-amber-500 font-semibold border-b border-border pb-2">
                                        <FileText size={16} />
                                        <span>Utkast: ÄTA</span>
                                    </div>
                                    <div className="space-y-2 text-sm text-foreground mb-4">
                                        <div className="flex justify-between">
                                            <span className="text-muted-foreground">Beskrivning:</span>
                                            <span className="font-medium">{m.draft.description}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-muted-foreground">Antal:</span>
                                            <span>{m.draft.quantity}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-muted-foreground">Est. Pris:</span>
                                            <span>{m.draft.estimatedCost} kr</span>
                                        </div>
                                    </div>
                                    <div className="flex gap-2">
                                        <button onClick={() => handleApproval(m.draft.id, true)} className="flex-1 bg-emerald-600 text-white py-2 rounded-md hover:bg-emerald-700 text-xs font-medium flex items-center justify-center gap-1 transition-colors">
                                            <Check size={14} /> Godkänn
                                        </button>
                                        <button onClick={() => handleApproval(m.draft.id, false)} className="flex-1 bg-secondary text-foreground py-2 rounded-md hover:bg-secondary/80 text-xs font-medium flex items-center justify-center gap-1 transition-colors">
                                            <Ban size={14} /> Avböj
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}
                    {isLoading && (
                        <div className="flex justify-start animate-pulse">
                            <div className="bg-card p-3 rounded-lg border text-muted-foreground text-sm">
                                AI arbetar...
                            </div>
                        </div>
                    )}
                    <div ref={messagesEndRef} />
                </div>

                {/* Input */}
                <div className="p-4 bg-card border-t border-border">
                    <div className="flex gap-2 items-center">
                        <button
                            onClick={isRecording ? stopRecording : startRecording}
                            className={`p-3 rounded-full transition-all ${isRecording
                                ? 'bg-red-500 text-white animate-pulse'
                                : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
                                }`}
                            title={isRecording ? "Stop Recording" : "Start Recording"}
                        >
                            {isRecording ? <Square size={20} /> : <Mic size={20} />}
                        </button>

                        <input
                            type="text"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                            placeholder="Skriv eller prata..."
                            className="flex-1 input-field"
                            disabled={isLoading || isRecording}
                        />
                        <button
                            onClick={handleSend}
                            disabled={isLoading || !input.trim()}
                            className="bg-primary text-primary-foreground p-3 rounded-full hover:bg-primary/90 disabled:opacity-50 transition-colors"
                        >
                            <Send size={20} />
                        </button>
                    </div>
                </div>
            </div>
        </>
    );
}
