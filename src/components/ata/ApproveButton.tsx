'use client';

import { useState } from 'react';
import { approveChangeOrderAction } from '@/app/actions';
import { useRouter } from 'next/navigation';

export function ApproveButton({ ataId }: { ataId: string }) {
    const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
    const [message, setMessage] = useState('');
    const router = useRouter();

    const handleApprove = async () => {
        setStatus('loading');
        const res = await approveChangeOrderAction(ataId, true, 'link', `Web Approval at ${new Date().toISOString()}`);
        if (res.success) {
            setStatus('success');
            setMessage('Tack! ÄTA är godkänd. Vi sätter igång!');
        } else {
            setStatus('error');
            setMessage('Ett fel uppstod: ' + res.error);
        }
    };

    if (status === 'success') {
        return (
            <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-6 text-center animate-in fade-in zoom-in duration-300">
                <div className="text-4xl mb-2">✅</div>
                <h3 className="text-xl font-bold text-green-400">Godkänt!</h3>
                <p className="text-zinc-400 mt-2">{message}</p>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-4">
            {status === 'error' && (
                <div className="bg-red-500/10 text-red-400 p-4 rounded-lg text-sm">
                    {message}
                </div>
            )}

            <button
                onClick={handleApprove}
                disabled={status === 'loading'}
                className="w-full bg-green-600 hover:bg-green-500 text-white font-bold py-4 px-6 rounded-xl shadow-lg hover:shadow-green-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
                {status === 'loading' ? (
                    'Bearbetar...'
                ) : (
                    <>
                        <span>🖋️</span>
                        <span>Godkänn ÄTA & Beställ Jobbet</span>
                    </>
                )}
            </button>
            <p className="text-center text-xs text-zinc-500">
                Genom att klicka godkänner du att arbetet startas enligt specifikation.
            </p>
        </div>
    );
}
