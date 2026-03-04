import { downloadUrl } from '../utils/api';
import useToastStore from '../stores/toastStore';

const FORMATS = [
  { key: 'pdf', label: 'PDF', icon: '📄' },
  { key: 'docx', label: 'DOCX', icon: '📝' },
  { key: 'html', label: 'HTML', icon: '🌐' },
];

export default function ExportButtons({ caseId }) {
  const addToast = useToastStore((s) => s.addToast);

  if (!caseId) return null;

  function handleClick(fmt) {
    addToast(`${fmt.label} downloaded successfully`, 'success');
  }

  return (
    <div className="bg-white border rounded-lg p-4">
      <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
        Export Report
      </h4>
      <div className="flex gap-2">
        {FORMATS.map((fmt) => {
          const url = downloadUrl(caseId, fmt.key);
          const token = localStorage.getItem('secnd_token') || '';
          const authUrl = token ? `${url}?token=${encodeURIComponent(token)}` : url;
          return (
            <a
              key={fmt.key}
              href={authUrl}
              download
              onClick={() => handleClick(fmt)}
              className="flex-1 flex items-center justify-center gap-1 px-3 py-2 text-sm font-medium border rounded-lg hover:bg-gray-50 transition-colors"
            >
              <span>{fmt.icon}</span>
              {fmt.label}
            </a>
          );
        })}
      </div>
    </div>
  );
}
