import { CheckCircle2, Circle } from 'lucide-react';

const categoryConfig = {
  biosecurity: { label: 'Biosecurity', cls: 'bg-blue-100 text-blue-700' },
  environment: { label: 'Environment', cls: 'bg-teal-100 text-teal-700' },
  treatment: { label: 'Treatment', cls: 'bg-purple-100 text-purple-700' },
  vet_alert: { label: 'Vet Alert', cls: 'bg-red-100 text-red-700' },
  nutrition: { label: 'Nutrition', cls: 'bg-orange-100 text-orange-700' },
};

function getCategoryConfig(cat) {
  return categoryConfig[cat] || { label: cat || 'General', cls: 'bg-gray-100 text-gray-600' };
}

export default function MitigationList({ mitigations = [], onComplete }) {
  if (!mitigations.length) {
    return (
      <div className="text-center py-8 text-[#9CA3AF] text-sm">
        No mitigation actions available.
      </div>
    );
  }

  return (
    <ol className="space-y-3">
      {mitigations.map((m, i) => {
        const catCfg = getCategoryConfig(m.category);
        const completed = m.is_completed;
        return (
          <li
            key={m.id || i}
            className={`flex items-start gap-3 p-4 rounded-xl border transition-all ${
              completed
                ? 'bg-gray-50 border-gray-200 opacity-60'
                : 'bg-white border-[#E5E7EB]'
            }`}
          >
            {/* Rank badge */}
            <div
              className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold mt-0.5 ${
                completed ? 'bg-gray-200 text-gray-500' : 'bg-[#1A2332] text-white'
              }`}
            >
              {i + 1}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-medium ${completed ? 'line-through text-[#9CA3AF]' : 'text-[#1A2332]'}`}>
                {m.action_text || m.action}
              </p>
              <div className="flex flex-wrap items-center gap-2 mt-1.5">
                <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${catCfg.cls}`}>
                  {catCfg.label}
                </span>
                {(m.disease_ref || m.disease_name) && (
                  <span className="text-[11px] text-[#9CA3AF] capitalize">
                    Re: {(m.disease_ref || m.disease_name).replace(/_/g, ' ')}
                  </span>
                )}
              </div>
            </div>

            {/* Checkbox */}
            <button
              onClick={() => !completed && onComplete && onComplete(m.id)}
              disabled={completed}
              className={`flex-shrink-0 mt-0.5 transition-colors ${
                completed ? 'text-green-500 cursor-default' : 'text-gray-300 hover:text-[#2E7D52]'
              }`}
              title={completed ? 'Completed' : 'Mark as complete'}
            >
              {completed ? <CheckCircle2 size={22} /> : <Circle size={22} />}
            </button>
          </li>
        );
      })}
    </ol>
  );
}
