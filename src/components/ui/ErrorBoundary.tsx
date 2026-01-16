'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';

interface Props {
    children?: ReactNode;
    fallback?: ReactNode;
}

interface State {
    hasError: boolean;
    error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
    public state: State = {
        hasError: false
    };

    public static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error("Uncaught error:", error, errorInfo);
    }

    public render() {
        if (this.state.hasError) {
            if (this.props.fallback) return this.props.fallback;

            return (
                <div className="p-4 rounded-lg border border-red-200 bg-red-50 text-red-800 flex items-center gap-3 text-sm">
                    <AlertTriangle size={16} />
                    <div>
                        <span className="font-semibold block">Något gick fel här.</span>
                        <span className="text-xs opacity-75">Kunde inte ladda komponenten.</span>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}
