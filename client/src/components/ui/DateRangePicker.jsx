import { Datepicker } from "flowbite-react";

export function DateRangePicker({
  startDate,
  endDate,
  onRangeChange,
  availableStartDate,
  availableEndDate,
  fixedWindowMonths = null,
}) {
  const today = new Date();
  const datepickerTheme = {
    root: {
      input: {
        field: {
          input: {
            base: "block w-full rounded-lg border border-sky-200 bg-sky-50 text-slate-900 focus:border-sky-300 focus:outline-none focus:ring-1 focus:ring-sky-200 disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:border-slate-600 dark:focus:ring-slate-700",
          },
        },
      },
    },
  };

  const handleStartChange = (date) => {
    const nextStartDate = date;
    let nextEndDate = endDate;

    if (fixedWindowMonths && date) {
      nextEndDate = new Date(date)
      nextEndDate.setMonth(nextEndDate.getMonth() + fixedWindowMonths)
      if (availableEndDate && nextEndDate > availableEndDate) {
        nextEndDate = availableEndDate
      }
      if (availableStartDate && nextStartDate < availableStartDate) {
        nextEndDate = new Date(availableStartDate)
        nextEndDate.setMonth(nextEndDate.getMonth() + fixedWindowMonths)
        if (availableEndDate && nextEndDate > availableEndDate) nextEndDate = availableEndDate
      }
    } else if (endDate && date && date > endDate) {
      nextEndDate = date
    }

    onRangeChange?.({
      startDate: nextStartDate,
      endDate: nextEndDate,
    });
  };

  const handleEndChange = (date) => {
    const nextEndDate = date;
    let nextStartDate = startDate;

    if (fixedWindowMonths && date) {
      nextStartDate = new Date(date)
      nextStartDate.setMonth(nextStartDate.getMonth() - fixedWindowMonths)
      if (availableStartDate && nextStartDate < availableStartDate) {
        nextStartDate = availableStartDate
      }
    } else if (startDate && date && date < startDate) {
      nextStartDate = date
    }

    onRangeChange?.({
      startDate: nextStartDate,
      endDate: nextEndDate,
    });
  };

  return (
    <div className="relative z-50 grid gap-4 overflow-visible sm:grid-cols-2">
      <div className="relative z-50 w-full overflow-visible">
        <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-slate-700 dark:text-slate-300">
          From
        </span>
        <Datepicker
          theme={datepickerTheme}
          value={startDate || undefined}
          onChange={handleStartChange}
          minDate={availableStartDate || undefined}
          maxDate={endDate || availableEndDate || today}
          showTodayButton
          placeholder="Select start date"
        />
      </div>

      <div className="relative z-50 w-full overflow-visible">
        <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-slate-700 dark:text-slate-300">
          To
        </span>
        <Datepicker
          theme={datepickerTheme}
          value={endDate || undefined}
          onChange={handleEndChange}
          minDate={startDate || undefined}
          maxDate={availableEndDate || new Date()}
          showTodayButton
          placeholder="Select end date"
        />
      </div>
    </div>
  );
}

export default DateRangePicker;