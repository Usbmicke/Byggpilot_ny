import ProtectedRoute from '@/components/ProtectedRoute';
import OnboardingWizard from '@/components/OnboardingWizard';
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
            <div className="flex h-screen bg-gray-100">
                <Sidebar />

                <div className="flex-1 flex flex-col overflow-hidden">
                    <Header />

                    <main className="flex-1 overflow-x-hidden overflow-y-auto bg-gray-100 p-6">
                        {children}
                    </main>
                </div>
            </div>
            <CommandCenter />

            <ChatInterface />
        </ProtectedRoute>
    );
}
