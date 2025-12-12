import ProtectedRoute from '@/components/ProtectedRoute';

import Sidebar from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';
import CommandCenter from '@/components/CommandCenter';
import ChatInterface from '@/components/chat/ChatInterface';

export default function ProtectedLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <ProtectedRoute>
            <div className="flex h-screen bg-background">
                <Sidebar />

                <div className="flex-1 flex flex-col overflow-hidden">
                    <Header />

                    <main className="flex-1 overflow-x-hidden overflow-y-auto bg-background p-6 pb-32">
                        {children}
                    </main>
                </div>
            </div>
            <CommandCenter />

            <ChatInterface />
        </ProtectedRoute>
    );
}
