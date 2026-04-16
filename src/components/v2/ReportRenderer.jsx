import FormattedMarkdown from '../../utils/formatReport';

export default function ReportRenderer({ report }) {
  if (!report) return null;

  const { markdown, version, is_provisional, treatment_holds = [], completeness_added = [] } = report;

  return (
    <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
      {/* Report header */}
      <div className="px-5 py-3 bg-gradient-to-r from-indigo-50 to-purple-50 border-b border-gray-200 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <svg className="w-5 h-5 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15a2.25 2.25 0 012.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25z" />
          </svg>
          <span className="text-sm font-semibold text-gray-800">Verified Second Opinion</span>
          <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700">
            v{version}
          </span>
          {is_provisional && (
            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
              Provisional
            </span>
          )}
        </div>
      </div>

      {/* Treatment holds banner */}
      {treatment_holds.length > 0 && (
        <div className="px-5 py-2.5 bg-red-50 border-b border-red-100">
          <div className="flex items-start gap-2">
            <svg className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
            </svg>
            <div>
              <p className="text-xs font-semibold text-red-700">
                {treatment_holds.length} Treatment Hold{treatment_holds.length > 1 ? 's' : ''}
              </p>
              {treatment_holds.map((h, i) => (
                <p key={i} className="text-xs text-red-600 mt-0.5">
                  Hold: {h.treatment} — {h.unexcluded_diagnosis} not excluded
                </p>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Completeness additions */}
      {completeness_added.length > 0 && (
        <div className="px-5 py-2 bg-blue-50 border-b border-blue-100">
          <p className="text-xs text-blue-700">
            <span className="font-medium">Completeness check added:</span>{' '}
            {completeness_added.map((c) => c.diagnosis).join(', ')}
          </p>
        </div>
      )}

      {/* Report body */}
      <div className="px-5 py-4">
        <FormattedMarkdown content={markdown} />
      </div>
    </div>
  );
}
