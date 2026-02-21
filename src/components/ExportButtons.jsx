import { downloadUrl } from '../utils/api';

const FORMATS = [
  { key: 'pdf', label: 'PDF', icon: '📄' },
  { key: 'docx', label: 'DOCX', icon: '📝' },
  { key: 'html', label: 'HTML', icon: '🌐' },
];

export default function ExportButtons({ caseId }) {
  if (!caseId) return null;

  return (
    <div className="bg-white border rounded-lg p-4">
      <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
        Export Report
      </h4>
      <div className="flex gap-2">
        {FORMATS.map((fmt) => (
          <a
            key={fmt.key}
            href={downloadUrl(caseId, fmt.key)}
            download
            className="flex-1 flex items-center justify-center gap-1 px-3 py-2 text-sm font-medium border rounded-lg hover:bg-gray-50 transition-colors"
          >
            <span>{fmt.icon}</span>
            {fmt.label}
          </a>
        ))}
      </div>
    </div>
  );
}
