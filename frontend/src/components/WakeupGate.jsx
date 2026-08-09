import { useEffect, useState } from 'react';
import { useBackendWakeup } from '../hooks/useBackendWakeup';

export default function WakeupGate({ children }) {
  const { status, attempt } = useBackendWakeup();
  const [dots, setDots] = useState('');

  useEffect(() => {
    if (status !== 'waking') return;
    const dotCount = attempt % 4; // Cycles 0, 1, 2, 3
    setDots('.'.repeat(dotCount));
  }, [attempt, status]);

  if (status === 'ready') {
    return children;
  }

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-[#0f1010] z-50">
      <div className="bg-white/[0.06] backdrop-blur-md border border-white/[0.10] rounded-2xl shadow-glass p-8 flex flex-col items-center max-w-sm w-full mx-4 text-center">
        {status === 'waking' && (
          <>
            <div className="w-12 h-12 border-4 border-green-500/30 border-t-green-500 rounded-full animate-spin mb-6"></div>
            <h2 className="text-xl font-semibold text-white mb-2 flex items-center justify-center">
              Waking up server<span className="inline-block w-4 text-left">{dots}</span>
            </h2>
            {attempt > 3 && (
              <p className="text-gray-400 text-sm mt-2 transition-opacity duration-500 opacity-100">
                Taking longer than usual, hang tight
              </p>
            )}
          </>
        )}
        {status === 'error' && (
          <>
            <div className="w-12 h-12 flex items-center justify-center rounded-full bg-red-500/20 text-red-500 mb-6">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-white mb-2">Could not reach server.</h2>
            <p className="text-gray-400 text-sm">Please try again later.</p>
          </>
        )}
      </div>
    </div>
  );
}
