'use client';

import { useEffect } from 'react';

export default function GlobalError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        console.error(error);
    }, [error]);

    return (
        <html>
            <body className="bg-gray-100 flex items-center justify-center h-screen font-sans">
                <div className="bg-white p-8 rounded-lg shadow-xl max-w-md w-full text-center">
                    <div className="mb-6">
                        <div className="h-16 w-16 bg-red-100 rounded-full flex items-center justify-center mx-auto">
                            <span className="text-3xl">⚠️</span>
                        </div>
                    </div>

                    <h2 className="text-2xl font-bold text-gray-800 mb-2">Hoppsan, något gick fel!</h2>
                    <p className="text-gray-600 mb-6">
                        Ett kritiskt fel inträffade. Våra tekniker har automatiskt underrättats om problemet.
                    </p>

                    <button
                        onClick={() => reset()}
                        className="w-full bg-indigo-600 text-white font-medium py-2 px-4 rounded hover:bg-indigo-700 transition-colors"
                    >
                        Försök igen
                    </button>

                    {process.env.NODE_ENV === 'development' && (
                        <div className="mt-8 text-left bg-gray-50 p-4 rounded text-xs text-red-600 overflow-auto max-h-40">
                            {error.message}
                        </div>
                    )}
                </div>
            </body>
        </html>
    );
}
