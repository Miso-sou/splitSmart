import { useEffect, useState } from 'react';
import { useBackendWakeup } from '../hooks/useBackendWakeup';
import { RefreshCw, AlertCircle } from 'lucide-react';

export default function WakeupGate({ children }) {
  const { status, attempt, retry } = useBackendWakeup();
  const [dots, setDots] = useState('');

  useEffect(() => {
    if (status !== 'waking') return;
    const dotCount = attempt % 4; // Cycles 0, 1, 2, 3
    setDots('.'.repeat(dotCount));
  }, [attempt, status]);

  // Mount application children ONLY after validated backend readiness
  if (status === 'ready') {
    return children;
  }

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-[#0f1010] z-50 transition-opacity duration-300">
      <div className="bg-[#18191a] border border-white/[0.08] rounded-3xl shadow-glass p-8 flex flex-col items-center max-w-sm w-full mx-4 text-center">
        {status === 'waking' && (
          <>
            <div className="w-12 h-12 border-4 border-green-500/20 border-t-green-500 rounded-full animate-spin mb-6"></div>
            <h2 className="text-xl font-semibold text-white mb-2 flex items-center justify-center">
              Waking up server<span className="inline-block w-4 text-left">{dots}</span>
            </h2>
            <p className="text-gray-400 text-sm mt-1">
              {attempt > 3
                ? 'Free instances on Render take up to a minute to spin up. Hang tight...'
                : 'Verifying server connection...'}
            </p>
          </>
        )}

        {status === 'error' && (
          <>
            <div className="w-12 h-12 flex items-center justify-center rounded-full bg-red-500/10 text-red-400 mb-6 border border-red-500/20">
              <AlertCircle className="w-6 h-6" />
            </div>
            <h2 className="text-xl font-semibold text-white mb-2">Could not reach server</h2>
            <p className="text-gray-400 text-sm mb-6 leading-relaxed">
              The server took too long to respond or is temporarily unavailable.
            </p>
            <button
              onClick={retry}
              className="flex items-center justify-center gap-2 w-full py-3 px-4 rounded-xl bg-white/[0.08] hover:bg-white/[0.14] active:bg-white/[0.18] border border-white/[0.12] text-white font-medium text-sm transition-all duration-200"
            >
              <RefreshCw className="w-4 h-4" />
              Retry Connection
            </button>
          </>
        )}
      </div>
    </div>
  );
}
