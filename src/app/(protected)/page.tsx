'use client';

import { useAuth } from '@/components/AuthProvider';
import ProjectList from '@/components/dashboard/ProjectList';
import QuickLog from '@/components/dashboard/QuickLog';

export default function DashboardPage() {
    const { user } = useAuth();

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-gray-900">Översikt</h1>
                <p className="text-gray-500">Välkommen tillbaka, {user?.displayName || 'Användare'}.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="md:col-span-2 space-y-6">
                    <section>
                        <h2 className="text-lg font-medium text-gray-900 mb-4">Mina Projekt</h2>
                        <ProjectList />
                    </section>
                </div>

                <div className="space-y-6">
                    <QuickLog />
                    {/* Weather and TodoList widgets can be added here */}
                    <div className="bg-white rounded-lg shadow p-4 h-32 flex items-center justify-center text-gray-400 border border-dashed text-sm">
                        Väder Widget (Placeholder)
                    </div>
                    <div className="bg-white rounded-lg shadow p-4 h-64 flex items-center justify-center text-gray-400 border border-dashed text-sm">
                        Att-göra (Google Tasks)
                    </div>
                </div>
            </div>
        </div>
    );
}
