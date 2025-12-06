'use client'; // Error components must be Client Components

import { useEffect } from 'react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Logga felet till konsolen
    console.error(error);
  }, [error]);

  return (
    <div style={{
      textAlign: 'center',
      padding: '50px',
      fontFamily: 'sans-serif',
      color: '#333'
    }}>
      <h2>Hoppsan! Något gick fel.</h2>
      <p>Ett oväntat fel inträffade. Vårt tekniska team har automatiskt meddelats.</p>
      <p>Försök att ladda om sidan eller kom tillbaka senare.</p>
      <button
        onClick={() => reset()} // Försök att rendera om segmentet
        style={{
          padding: '10px 20px',
          marginTop: '20px',
          border: 'none',
          borderRadius: '5px',
          background: '#0070f3',
          color: 'white',
          cursor: 'pointer'
        }}
      >
        Försök igen
      </button>
      {/* För utveckling kan det vara bra att se själva felet */}
      {process.env.NODE_ENV === 'development' && (
        <pre style={{
          marginTop: '20px',
          padding: '15px',
          background: '#f3f3f3',
          borderRadius: '5px',
          textAlign: 'left',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-all'
        }}>
          <strong>Error Details:</strong>\n
          {error.message}
        </pre>
      )}
    </div>
  );
}
