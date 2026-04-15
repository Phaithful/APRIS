import { useState, useEffect } from 'react';
import { AlertTriangle, X } from 'lucide-react';

export default function ConfirmModal({
  isOpen,
  title,
  message,
  requireNameMatch,
  onConfirm,
  onCancel,
}) {
  const [inputValue, setInputValue] = useState('');

  useEffect(() => {
    if (!isOpen) setInputValue('');
  }, [isOpen]);

  if (!isOpen) return null;

  const canConfirm = requireNameMatch ? inputValue === requireNameMatch : true;

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) onCancel();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={handleBackdropClick}
    >
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
              <AlertTriangle size={20} className="text-red-600" />
            </div>
            <h2 className="text-lg font-semibold text-[#1A2332]">{title}</h2>
          </div>
          <button
            onClick={onCancel}
            className="text-[#9CA3AF] hover:text-[#374151] transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <p className="text-[#6B7280] text-sm mb-4">{message}</p>

        {requireNameMatch && (
          <div className="mb-4">
            <p className="text-sm text-[#374151] mb-2">
              Type <span className="font-semibold text-[#1A2332]">{requireNameMatch}</span> to confirm:
            </p>
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              className="form-input"
              placeholder={requireNameMatch}
              autoFocus
            />
          </div>
        )}

        <div className="flex items-center gap-3 justify-end">
          <button
            onClick={onCancel}
            className="btn-secondary"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={!canConfirm}
            className="bg-red-600 text-white rounded-[10px] px-5 py-2.5 text-sm font-medium hover:bg-red-700 transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
}
