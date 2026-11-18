import { useMemo } from 'react'
import DatePicker from '../../components/ui/DateRangePicker'
import { Button } from 'flowbite-react'
import { AnalyticsNlqPanel } from './AnalyticsNlqPanel'
import { ForecastBandChart, ForecastTrendChart } from './AnalyticsCharts'
import { formatDDMMYY } from './analyticsUtils'
import { useAnalyticsData } from './useAnalyticsData'

const analyticsButtonClass = 'cursor-pointer rounded-2xl border border-transparent bg-sky-500 px-4 py-2 text-white shadow-sm transition hover:bg-sky-400 focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0 active:translate-y-px active:shadow-[inset_0_2px_10px_rgba(15,23,42,0.22)] disabled:cursor-not-allowed'
const analyticsOutlineButtonClass = 'cursor-pointer rounded-2xl border border-transparent bg-white px-4 py-2 text-sky-900 shadow-sm transition hover:border-sky-200 hover:bg-sky-50 focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0 active:translate-y-px active:shadow-[inset_0_2px_10px_rgba(15,23,42,0.14)] disabled:cursor-not-allowed dark:bg-slate-900 dark:text-slate-100 dark:hover:border-white/10 dark:hover:bg-slate-800'

function formatDate(date) {
  if (!date) return 'Any time'

  return new Intl.DateTimeFormat('en-NZ', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date)
}

function AnalyticsShell({ dateRange, setDateRange }) {
  const {
    anomalies,
    csvFile,
    errorMsg,
    forecastPts,
    hasData,
    loadingAnomalies,
    loadingForecast,
    loadingQuery,
    loadingUpload,
    queryCols,
    queryHistory,
    queryResult,
    queryText,
    refreshAnomalies,
    revenueTrendPts,
    runSavedForecast,
    statusMsg,
    setCsvFile,
    setQueryText,
    submitQuery,
    loadHistoryQuery,
    uploadCsv,
    uploadedFileName,
    uploadedCsvs,
    activatingCsvId,
    activateCsv,
  } = useAnalyticsData(dateRange)

  const rangeLbl =
    dateRange.startDate || dateRange.endDate
      ? `${formatDate(dateRange.startDate)} - ${formatDate(dateRange.endDate)}`
      : 'Select a date range to focus the dashboard'

  const availableDates = useMemo(() => {
    if (!revenueTrendPts.length) return { start: null, end: null }

    const dates = revenueTrendPts
      .map((point) => point.date)
      .filter(Boolean)
      .sort()

    return {
      start: dates.length ? new Date(`${dates[0]}T00:00:00`) : null,
      end: dates.length ? new Date(`${dates[dates.length - 1]}T00:00:00`) : null,
    }
  }, [revenueTrendPts])

  const availableRangeLbl =
    availableDates.start && availableDates.end
      ? `${formatDDMMYY(availableDates.start.toISOString().split('T')[0])} - ${formatDDMMYY(availableDates.end.toISOString().split('T')[0])}`
      : null

  const prompts = useMemo(
    () => [
      'Total revenue this month',
      'Show revenue forecast for next month',
      'Detect anomalies in revenue',
      'Which day had the highest revenue?',
    ],
    []
  )

  return (
    <div className="relative min-h-full overflow-x-hidden px-4 pt-2 pb-4 text-slate-900 sm:px-6 lg:px-8 dark:text-slate-100">
      <div className="relative z-10 space-y-6">
        <section className="grid gap-4 lg:grid-cols-3">
          <article className="relative z-50 overflow-visible rounded-[26px] border border-sky-200/80 bg-white/80 p-4 shadow-lg shadow-sky-200/40 backdrop-blur-md transition-colors duration-200 dark:border-white/15 dark:bg-white/10 dark:shadow-none">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-base font-semibold text-slate-900 dark:text-white">Date filter</h2>
                <p className="mt-1 text-sm text-slate-600 dark:text-sky-100/70">
                  Select a date range to view analytics for that period.
                </p>
              </div>
            </div>

            <div className="relative z-50 mt-4 overflow-visible">
              {availableRangeLbl ? (
                <div className="mb-3 rounded-xl border border-sky-200 bg-sky-50/70 px-3 py-2.5 dark:border-white/10 dark:bg-sky-950/20">
                  <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">
                    Available dates
                  </p>
                  <p className="mt-1 text-sm font-semibold text-sky-800 dark:text-sky-200">
                    {uploadedFileName || 'Selected CSV'}: {availableRangeLbl}
                  </p>
                </div>
              ) : (
                <div className="mb-3 rounded-xl border border-dashed border-sky-200 px-3 py-2.5 text-xs text-slate-500 dark:border-white/10 dark:text-slate-400">
                  Upload or select a CSV to show available dates.
                </div>
              )}
              <DatePicker
                startDate={dateRange.startDate}
                endDate={dateRange.endDate}
                onRangeChange={setDateRange}
                availableStartDate={availableDates.start}
                availableEndDate={availableDates.end}
              />
            </div>
          </article>

          <article className="rounded-[26px] border border-sky-200/80 bg-white/80 p-4 shadow-lg shadow-sky-200/40 backdrop-blur-md transition-colors duration-200 dark:border-white/15 dark:bg-white/10 dark:shadow-none">
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">CSV upload</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-sky-100/75">
              Upload a CSV to refresh the analytics inputs.
            </p>

            <div className="mt-4 grid grid-cols-2 items-start gap-3">
              <div>
                <label className="block cursor-pointer rounded-2xl border border-dashed border-sky-300 bg-sky-50/80 p-2 text-sm text-sky-800 transition hover:bg-sky-100 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-200 dark:hover:bg-slate-900/60">
                  <span className="block font-medium">Choose CSV file</span>
                  <span className="mt-1 block truncate text-xs text-sky-700/80 dark:text-slate-400">
                    {csvFile ? csvFile.name : 'No file selected yet'}
                  </span>
                  <input
                    type="file"
                    accept=".csv,text/csv"
                    className="sr-only"
                    onChange={(event) => setCsvFile(event.target.files?.[0] || null)}
                  />
                </label>

                <Button
                  className={`mt-3 w-full ${analyticsButtonClass}`}
                  size="md"
                  onClick={() => uploadCsv(csvFile)}
                  disabled={loadingUpload || uploadedCsvs.length >= 5}
                >
                  {loadingUpload ? 'Uploading...' : uploadedCsvs.length >= 5 ? 'CSV limit' : 'Upload'}
                </Button>
              </div>

              <div className="min-w-0 border-l border-sky-100 pl-3 dark:border-white/10">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                    Saved Data
                  </h3>
                  <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                    {uploadedCsvs.length}/5
                  </span>
                </div>

                {uploadedCsvs.length ? (
                  <div className="mt-2 max-h-[140px] space-y-2 overflow-y-auto">
                    {uploadedCsvs.map((upload) => (
                      <button
                        key={upload.id}
                        type="button"
                        onClick={() => activateCsv(upload.id)}
                        disabled={activatingCsvId === upload.id}
                        className={`w-full rounded-xl border px-3 py-2 text-left transition ${
                          upload.isActive
                            ? 'border-sky-400 bg-sky-100 text-sky-900 dark:border-sky-500 dark:bg-sky-900/40 dark:text-sky-100'
                            : 'border-sky-100 bg-white text-slate-700 hover:border-sky-300 hover:bg-sky-50 dark:border-white/10 dark:bg-slate-950/40 dark:text-slate-200 dark:hover:bg-slate-900'
                        }`}
                      >
                        <span className="block truncate text-sm font-medium">
                          {activatingCsvId === upload.id ? 'Activating...' : upload.fileName}
                        </span>
                        <span className="mt-1 block text-xs text-slate-500 dark:text-slate-400">
                          {upload.rowCount} rows
                          {upload.startDate && upload.endDate
                            ? ` · ${formatDDMMYY(upload.startDate)}–${formatDDMMYY(upload.endDate)}`
                            : ''}
                        </span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                    Upload a CSV to get started.
                  </p>
                )}
              </div>
            </div>
            {statusMsg ? (
              <p className="mt-3 text-sm font-medium text-emerald-700 dark:text-emerald-300" role="status">
                {statusMsg}
              </p>
            ) : null}
            {errorMsg ? (
              <p className="mt-3 text-sm font-medium text-rose-700 dark:text-rose-300" role="alert">
                {errorMsg}
              </p>
            ) : null}

          </article>

          <article className="rounded-[26px] border border-sky-200/80 bg-white/80 p-4 shadow-lg shadow-sky-200/40 backdrop-blur-md transition-colors duration-200 dark:border-white/15 dark:bg-white/10 dark:shadow-none">
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">Anomalies</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-sky-100/75">
              Dates and types of anomalies from your data.
            </p>
            <div className="mt-4 flex items-center gap-2">
              <Button size="sm" className={analyticsButtonClass} onClick={refreshAnomalies} disabled={loadingAnomalies || !hasData}>
                {loadingAnomalies ? 'Refreshing...' : 'Refresh anomalies'}
              </Button>
            </div>
           <div className="mt-4 overflow-hidden rounded-2xl border border-sky-100 dark:border-white/10">
              <table className="w-full text-left text-sm">
                <thead className="sticky top-0 bg-sky-50 text-sky-900 dark:bg-slate-900/70 dark:text-slate-200">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Date</th>
                    <th className="px-4 py-3 font-semibold">Revenue</th>
                    <th className="px-4 py-3 font-semibold">Event</th>
                    <th className="px-4 py-3 font-semibold">Severity</th>
                  </tr>
                </thead>
              </table>
              <div className="max-h-[220px] overflow-y-auto">
                <table className="w-full text-left text-sm">
                  <tbody className="divide-y divide-sky-100 bg-white dark:divide-white/10 dark:bg-slate-950/40">
                    {anomalies.length ? anomalies.map((it) => (
                      <tr key={`${it.date}-${it.type}`} className={it.severity === 'high' ? 'bg-rose-50/70 dark:bg-rose-950/20' : ''}>
                        <td className="px-4 py-3 text-slate-700 dark:text-slate-200">{formatDDMMYY(it.date)}</td>
                        <td className="px-4 py-3 text-slate-700 dark:text-slate-200">
                          ${it.value?.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </td>
                        <td className="px-4 py-3 text-slate-700 dark:text-slate-200">{it.holiday_name || '—'}</td>
                        <td className="px-4 py-3 text-slate-700 dark:text-slate-200">{it.severity}</td>
                      </tr>
                    )) : null}
                  </tbody>
                </table>
              </div>
              {!anomalies.length ? (
                <div className="border-t border-sky-100 bg-white px-4 py-3 text-sm text-slate-500 dark:border-white/10 dark:bg-slate-950/40 dark:text-slate-300">
                  Upload a CSV to get started.
                </div>
              ) : null}
            </div>
          </article>
        </section>

        <section className="grid gap-4 lg:grid-cols-[0.8fr_1.2fr]">
          <article className="rounded-[26px] border border-sky-200/80 bg-white/80 p-5 shadow-lg shadow-sky-200/40 backdrop-blur-md transition-colors duration-200 dark:border-white/15 dark:bg-white/10 dark:shadow-none">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-base font-semibold text-slate-900 dark:text-white">Revenue trend</h2>
                <p className="mt-1 text-sm text-slate-600 dark:text-sky-100/70">
                  Revenue trend across the selected date range.
                </p>
              </div>
            </div>
            <div className="mt-5 rounded-2xl bg-sky-50/70 p-4 dark:bg-slate-900/40">
              <ForecastTrendChart data={revenueTrendPts} />
            </div>
          </article>

          <article className="rounded-[26px] border border-sky-200/80 bg-white/80 p-5 shadow-lg shadow-sky-200/40 backdrop-blur-md transition-colors duration-200 dark:border-white/15 dark:bg-white/10 dark:shadow-none">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="flex items-center gap-1.5">
                  <h2 className="text-base font-semibold text-slate-900 dark:text-white">Forecast chart</h2>
                  <span
                    className="inline-flex h-4 w-4 cursor-help items-center justify-center rounded-full bg-sky-200 text-[10px] font-bold text-sky-800 dark:bg-sky-800 dark:text-sky-100"
                    title="The confidence band (shaded area) shows the range the model expects actual revenue to fall within. A narrower band means the model is more certain; a wider band means more uncertainty in that prediction."
                  >
                    ?
                  </span>
                </div>
                <p className="mt-1 text-sm text-slate-600 dark:text-sky-100/70">
                  Six-month predicted revenue with confidence band.
                </p>
              </div>
              <div className="flex gap-2">
                <Button size="sm" className={analyticsButtonClass} onClick={runSavedForecast} disabled={loadingForecast || !forecastPts.length}>
                  {loadingForecast ? 'Running...' : 'Run forecast'}
                </Button>
                <Button size="sm" className={analyticsOutlineButtonClass} onClick={runSavedForecast} disabled={loadingForecast || !forecastPts.length}>
                  Load saved
                </Button>
              </div>
            </div>
            <div className="mt-5 rounded-2xl bg-sky-50/70 p-4 dark:bg-slate-900/40">
              <ForecastBandChart data={forecastPts} />
            </div>
          </article>
        </section>

        <AnalyticsNlqPanel
          loadingQuery={loadingQuery}
          promptChips={prompts}
          queryColumns={queryCols}
          queryHistory={queryHistory}
          queryResult={queryResult}
          queryText={queryText}
          onChipClick={(question) => submitQuery(question)}
          onHistoryClick={loadHistoryQuery}
          onQueryTextChange={setQueryText}
          onSubmitQuery={submitQuery}
        />

      </div>
    </div>
  )
}

export default AnalyticsShell