'use client';

import { useState, useEffect } from 'react';
import { getTasksAction } from '@/app/actions/tasks';
import { ListChecks, CheckCircle2, Circle, Loader2, Plus, ExternalLink } from 'lucide-react';

interface Task {
    id: string;
    title: string;
    status: 'needsAction' | 'completed';
    listTitle?: string;
}

export default function TasksWidget() {
    const [tasks, setTasks] = useState<Task[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        loadTasks();
    }, []);

    const loadTasks = async () => {
        try {
            const token = localStorage.getItem('google_access_token') || undefined;
            if (!token) {
                setLoading(false);
                return; // Silent fail if no token (auth handled elsewhere)
            }
            const res = await getTasksAction(token);
            if (res.success) {
                setTasks(res.tasks);
            } else {
                setError(res.error || 'Failed to load tasks');
            }
        } catch (e) {
            setError('Error loading tasks');
        } finally {
            setLoading(false);
        }
    };

    const incompleteTasks = tasks.filter(t => t.status === 'needsAction');

    return (
        <div className="bg-white dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 h-full flex flex-col shadow-sm">
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2">
                    <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                        <ListChecks className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div>
                        <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">Mina Uppgifter</h3>
                        <p className="text-xs text-zinc-500 dark:text-zinc-400">{incompleteTasks.length} kvar att göra</p>
                    </div>
                </div>
                <button
                    onClick={() => window.open('https://tasks.google.com', '_blank')}
                    className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full text-zinc-400 hover:text-blue-500 transition-colors"
                    title="Öppna Google Tasks"
                >
                    <ExternalLink size={16} />
                </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3 pretty-scrollbar pr-2">
                {loading ? (
                    <div className="flex justify-center py-8">
                        <Loader2 className="w-6 h-6 text-zinc-400 animate-spin" />
                    </div>
                ) : tasks.length === 0 ? (
                    <div className="text-center py-8 text-zinc-500 text-sm">
                        Inga uppgifter hittades.
                        <br />
                        <span className="text-xs opacity-70">Synkas från listor som börjar med "ByggPilot"</span>
                    </div>
                ) : (
                    incompleteTasks.length > 0 ? (
                        incompleteTasks.map(task => (
                            <div key={task.id} className="group flex items-start gap-3 p-3 rounded-xl hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors border border-transparent hover:border-zinc-200 dark:hover:border-zinc-700/50">
                                <button className="mt-0.5 text-zinc-400 hover:text-emerald-500 transition-colors">
                                    <Circle size={18} />
                                </button>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300 truncate">{task.title}</p>
                                    {task.listTitle && (
                                        <p className="text-[10px] text-zinc-400 uppercase tracking-wider mt-0.5 truncate">{task.listTitle.replace('ByggPilot - ', '')}</p>
                                    )}
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="text-center py-8">
                            <div className="inline-flex p-3 bg-emerald-100 dark:bg-emerald-900/20 rounded-full mb-2">
                                <CheckCircle2 className="w-6 h-6 text-emerald-600 dark:text-emerald-500" />
                            </div>
                            <p className="text-sm text-zinc-600 dark:text-zinc-400 font-medium">Allt klart!</p>
                        </div>
                    )
                )}
            </div>

            <div className="mt-4 pt-4 border-t border-zinc-100 dark:border-zinc-800/50">
                <button
                    disabled
                    className="w-full py-2 flex items-center justify-center gap-2 text-sm font-medium text-zinc-400 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg cursor-not-allowed"
                >
                    <Plus size={16} />
                    Lägg till uppgift (via Chatten)
                </button>
            </div>
        </div>
    );
}
