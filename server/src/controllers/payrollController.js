const db = require('../config/db');
const { calcPayRun } = require('../utils/payrollEngine');
const { generatePayslipPDF } = require('../utils/payslipPDF');
const {
  isValidDateRange,
  toFiniteNumber,
  safeDownloadName,
  normalizeEmploymentType,
  calculateShiftHours,
} = require('../utils/payrollHelpers');

function sendError(res, status, message, error) {
  if (error) console.error(message, error)
  return res.status(status).json({ error: message })
}

function getTaxYearStart(payPeriodEnd) {
  const end = new Date(`${payPeriodEnd}T00:00:00`)
  if (Number.isNaN(end.getTime())) return null
  const startYear = end.getMonth() >= 3 ? end.getFullYear() : end.getFullYear() - 1
  return `${startYear}-04-01`
}

function normalizeEmployeeIds(employeeIds) {
  if (!Array.isArray(employeeIds)) return []
  return [...new Set(employeeIds
    .map(toFiniteNumber)
    .filter((id) => Number.isInteger(id) && id > 0))]
}

function buildPayslipData({
  businessName,
  firstName,
  lastName,
  address,
  hourlyRate,
  taxCode,
  irdNumber,
  payPeriodStart,
  payPeriodEnd,
  regularHours,
  result,
  employmentType,
  ytd = { gross: 0, paye: 0, kiwisaver: 0 },
}) {
  return {
    business: { businessName: businessName || '' },
    employee: {
      firstName,
      lastName,
      address,
      hourlyRate,
      taxCode,
      irdNumber,
    },
    period: {
      start: payPeriodStart,
      end: payPeriodEnd,
    },
    payPeriodInput: { regularHours },
    engineOutput: {
      regPay: result.regPay || 0,
      totalHolidayPay: result.totalHolidayPay || 0,
      leavePay: result.leavePay || 0,
      holidayPayAddition: result.holidayPayAddition || 0,
      employmentType,
      grossPay: result.grossPay,
      payeTax: result.payeTax,
      kiwisaverEmployee: result.kiwisaverEmployee,
      kiwisaverEmployer: result.kiwisaverEmployer,
      totalDeductions: result.totalDeductions,
      netPay: result.netPay,
    },
    ytdEarnings: ytd,
  }
}

async function createPayRun(req, res) {
  let client
  let transactionFinished = false
  try {
    const { employeeIds, payPeriod } = req.body;
    const { start, end } = payPeriod || {};
    const normalizedEmployeeIds = normalizeEmployeeIds(employeeIds)

    if (!normalizedEmployeeIds.length || !isValidDateRange(start, end)) {
      return res.status(400).json({
        error: 'employeeIds and a valid payPeriod start/end date range are required'
      });
    }


    // gets business and region
    const bizResult = await db.query(
      'SELECT business_id, public_holiday_region FROM businesses WHERE user_id = $1',
      [req.user.user_id]
    );

    if (!bizResult.rows.length) {
      return res.status(404).json({ message: 'No business found for this user' });
    }

    const { business_id, public_holiday_region } = bizResult.rows[0];
    const region = public_holiday_region || 'Canterbury';

    // fetchs employees with tax and KiwiSaver details
    const employeeResult = await db.query(
      `SELECT e.employee_id,
              u.first_name || ' ' || u.last_name AS name,
              e.hourly_rate,
              e.contract_type,
              e.tax_code,
              e.kiwisaver_rate
       FROM employees e
       JOIN users u ON e.user_id = u.user_id
       WHERE e.employee_id = ANY($1) AND e.business_id = $2`,
      [normalizedEmployeeIds, business_id]
    );

    if (!employeeResult.rows.length) {
      return res.status(404).json({ message: 'No matching employees found for this business' });
    }

    const matchedIds = employeeResult.rows.map((employee) => employee.employee_id)
    const skippedIds = normalizedEmployeeIds.filter((id) =>
      !matchedIds.some((matchedId) => Number(matchedId) === Number(id))
    )
    if (skippedIds.length) {
      return res.status(400).json({
        error: 'Some employees do not belong to this business',
        skippedEmployeeIds: skippedIds,
      })
    }

    client = await db.connect()
    await client.query('BEGIN')

    // fetchs shifts
    const shiftResult = await client.query(
      `SELECT employee_id, date, hours_worked
       FROM shifts
       WHERE employee_id = ANY($1)
         AND date >= $2 AND date <= $3`,
      [matchedIds, start, end]
    );

    const allShifts = shiftResult.rows;
    const results = [];

    const taxYearStart = getTaxYearStart(end)
    const ytdResult = await client.query(
      `SELECT employee_id,
              COALESCE(SUM(gross_pay), 0) AS ytd_gross,
              COALESCE(SUM(paye_tax), 0) AS ytd_paye,
              COALESCE(SUM(kiwisaver_employee), 0) AS ytd_kiwisaver
       FROM payslips
       WHERE employee_id = ANY($1)
         AND pay_period_end >= $2
         AND pay_period_end <= $3
       GROUP BY employee_id`,
      [matchedIds, taxYearStart, end],
    )
    const ytdByEmployee = new Map(
      ytdResult.rows.map((row) => [Number(row.employee_id), {
        gross: parseFloat(row.ytd_gross) || 0,
        paye: parseFloat(row.ytd_paye) || 0,
        kiwisaver: parseFloat(row.ytd_kiwisaver) || 0,
      }])
    )

    const duplicateResult = await client.query(
      `SELECT employee_id
       FROM payslips
       WHERE employee_id = ANY($1)
         AND pay_period_start = $2
         AND pay_period_end = $3`,
      [matchedIds, start, end],
    )
    if (duplicateResult.rows.length) {
      await client.query('ROLLBACK')
      transactionFinished = true
      return res.status(409).json({
        error: 'A payslip already exists for this employee and pay period',
        duplicateEmployeeIds: duplicateResult.rows.map((row) => row.employee_id),
      })
    }

    for (const emp of employeeResult.rows) {
      const empShifts = allShifts.filter(
        s => String(s.employee_id) === String(emp.employee_id)
      );

      // calculates hours and detects public holidays from shifts
      const { regularHours, publicHolidays } =
        calculateShiftHours(empShifts, region)

      // builds the employee and pay period objects for the payroll engine
      const engineEmployee = {
        hourlyRate: parseFloat(emp.hourly_rate),
        employmentType: normalizeEmploymentType(emp.contract_type),
        wageType: 'adult',
        // TEMP PLACEHOLDERS
        usualDaysPerWeek: 5,
        taxCode: emp.tax_code || 'M',
        kiwisaverRate: emp.kiwisaver_rate != null ? parseFloat(emp.kiwisaver_rate) : null,
      };

      const enginePayPeriod = {
        regularHours,
        overtimeHours: 0,
        publicHolidays,
        leaveDaysTaken: 0,
        // TEMP PLACEHOLDERS
        owp: parseFloat(emp.hourly_rate) * 40,
        awe: parseFloat(emp.hourly_rate) * 40,
      };

      const ytd = ytdByEmployee.get(Number(emp.employee_id)) || {
        gross: 0,
        paye: 0,
        kiwisaver: 0,
      }

      // wage error handling
      let result;
      try {
        result = calcPayRun(engineEmployee, enginePayPeriod, {
          ytdGross: ytd.gross,
          ytdPAYE: ytd.paye,
          ytdKiwiSaver: ytd.kiwisaver,
        });
      } catch (wageError) {
        await client.query('ROLLBACK')
        transactionFinished = true
        return res.status(400).json({
          error: wageError.message,
          employeeId: emp.employee_id,
          employeeName: emp.name,
        })
      }

      const newYtdGross = ytd.gross + result.grossPay;
      const newYtdPAYE = ytd.paye + result.payeTax;
      const newYtdKiwiSaver = ytd.kiwisaver + result.kiwisaverEmployee;
      const breakdown = {
        regPay: result.regPay,
        totalHolidayPay: result.totalHolidayPay,
        leavePay: result.leavePay,
        holidayPayAddition: result.holidayPayAddition,
        employmentType: emp.contract_type,
        regularHours,
      };
      const persistResult = await client.query(
        `INSERT INTO payslips
         (employee_id, business_id, pay_period_start, pay_period_end,
          gross_pay, paye_tax, kiwisaver_employee, kiwisaver_employer,
          total_deductions, net_pay,
          ytd_gross, ytd_paye, ytd_kiwisaver, breakdown)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
         RETURNING payslip_id`,
        [
          emp.employee_id, business_id, start, end,
          result.grossPay, result.payeTax, result.kiwisaverEmployee, result.kiwisaverEmployer,
          result.totalDeductions, result.netPay,
          newYtdGross, newYtdPAYE, newYtdKiwiSaver,
          JSON.stringify(breakdown)
        ]
      );

      results.push({
        payslip_id: persistResult.rows[0].payslip_id,
        employee_id: emp.employee_id,
        name: emp.name,
        ...result,
      });
    }

    await client.query('COMMIT')
    transactionFinished = true
    res.status(201).json({ results });

  } catch (error) {
    sendError(res, 500, 'Could not create the pay run', error)
  } finally {
    if (client) {
      if (!transactionFinished) {
        try { await client.query('ROLLBACK') } catch (rollbackError) {
          console.error('payroll transaction rollback failed', rollbackError)
        }
      }
      client.release()
    }
  }
}

// - Download Payslip PDF - //
async function downloadPayslipPDF(req, res) {
  try {
    const { id } = req.params;
    const parsedId = toFiniteNumber(id)
    if (parsedId == null || !Number.isInteger(parsedId)) {
      return res.status(400).json({ error: 'A valid payslip ID is required' })
    }

    const result = await db.query(
      `SELECT
         p.*,
         u.first_name, u.last_name,
         e.user_id AS employee_user_id, e.hourly_rate, e.contract_type, e.tax_code, e.ird_number,
         b.business_name, b.user_id AS manager_user_id
       FROM payslips p
       JOIN employees e ON p.employee_id = e.employee_id
       JOIN users u ON e.user_id = u.user_id
       JOIN businesses b ON p.business_id = b.business_id
       WHERE p.payslip_id = $1`,
      [parsedId]
    );

    if (!result.rows.length) {
      return res.status(404).json({ error: 'Payslip not found' });
    }

    const slip = result.rows[0];

    // authorization - only the employee or manager can view
    const isOwner = Number(req.user.user_id) === Number(slip.employee_user_id);
    const isManager = Number(req.user.user_id) === Number(slip.manager_user_id);
    if (!isOwner && !isManager) {
      return res.status(403).json({ error: 'Not authorized to view this payslip' });
    }
    const breakdown = slip.breakdown || {};
    const grossPay = parseFloat(slip.gross_pay);
    const payeTax = parseFloat(slip.paye_tax);
    const kiwisaverEmployee = parseFloat(slip.kiwisaver_employee);
    const kiwisaverEmployer = parseFloat(slip.kiwisaver_employer);
    const totalDeductions = parseFloat(slip.total_deductions);
    const netPay = parseFloat(slip.net_pay);

    const payslipData = {
      ...buildPayslipData({
        businessName: slip.business_name,
        firstName: slip.first_name,
        lastName: slip.last_name,
        address: undefined,
        hourlyRate: parseFloat(slip.hourly_rate),
        taxCode: slip.tax_code,
        irdNumber: slip.ird_number,
        payPeriodStart: slip.pay_period_start,
        payPeriodEnd: slip.pay_period_end,
        regularHours: breakdown.regularHours || 0,
        result: {
          grossPay,
          payeTax,
          kiwisaverEmployee,
          kiwisaverEmployer,
          totalDeductions,
          netPay,
          regPay: breakdown.regPay,
          totalHolidayPay: breakdown.totalHolidayPay,
          leavePay: breakdown.leavePay,
          holidayPayAddition: breakdown.holidayPayAddition,
        },
        employmentType: breakdown.employmentType || slip.contract_type,
        ytd: {
          gross: parseFloat(slip.ytd_gross) - grossPay,
          paye: parseFloat(slip.ytd_paye) - payeTax,
          kiwisaver: parseFloat(slip.ytd_kiwisaver) - kiwisaverEmployee,
        },
      }),
    };

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=payslip-${parsedId}.pdf`);

    generatePayslipPDF(payslipData, res);

  } catch (error) {
    if (!res.headersSent) {
      sendError(res, 500, 'Could not download the payslip', error)
    } else {
      console.error('downloadPayslipPDF stream failed', error)
      res.end()
    }
  }
}

// - List Pay Runs - //
async function listPayRuns(req, res) {
  try {
    const bizResult = await db.query(
      'SELECT business_id FROM businesses WHERE user_id = $1',
      [req.user.user_id]
    );

    if (!bizResult.rows.length) {
      return res.status(404).json({ message: 'No business found for this user' });
    }
    const businessId = bizResult.rows[0].business_id;
    const result = await db.query(
      `SELECT p.pay_period_start,
              p.pay_period_end,
              COUNT(*)::int AS employee_count,
              COALESCE(SUM(p.gross_pay), 0) AS gross_pay,
              COALESCE(SUM(p.total_deductions), 0) AS total_deductions,
              COALESCE(SUM(p.kiwisaver_employer), 0) AS employer_contributions,
              COALESCE(SUM(p.net_pay), 0) AS net_pay,
              MAX(p.created_at) AS created_at,
              JSON_AGG(
                JSON_BUILD_OBJECT(
                  'payslip_id', p.payslip_id,
                  'employee_id', p.employee_id,
                  'employee_name', u.first_name || ' ' || u.last_name,
                  'gross_pay', p.gross_pay,
                  'net_pay', p.net_pay,
                  'breakdown', p.breakdown
                )
              ) AS payslips
       FROM payslips p
       JOIN employees e ON p.employee_id = e.employee_id
       JOIN users u ON e.user_id = u.user_id
       WHERE p.business_id = $1
       GROUP BY p.pay_period_start, p.pay_period_end
       ORDER BY p.pay_period_start DESC, p.pay_period_end DESC`,
      [businessId]
    );

    res.json({ payRuns: result.rows });
  } catch (error) {
    sendError(res, 500, 'Could not load pay runs', error)
  }
}

// gets payslips for a specific employee
async function getPayslips(req, res) {
  try {
    const { employeeId } = req.params;
    const parsedEmployeeId = toFiniteNumber(employeeId)
    if (parsedEmployeeId == null || !Number.isInteger(parsedEmployeeId)) {
      return res.status(400).json({ error: 'A valid employeeId is required' })
    }
    let employeeQuery;
    let params;

    if (req.user.role === 'employee') {
      employeeQuery = 'SELECT employee_id FROM employees WHERE employee_id = $1 AND user_id = $2';
      params = [parsedEmployeeId, req.user.user_id];
    } else {
      employeeQuery = `SELECT e.employee_id
                       FROM employees e
                       JOIN businesses b ON e.business_id = b.business_id
                       WHERE e.employee_id = $1 AND b.user_id = $2`;
      params = [parsedEmployeeId, req.user.user_id];
    }

    const employeeResult = await db.query(employeeQuery, params);
    if (!employeeResult.rows.length) {
      return res.status(403).json({ error: 'Not authorized to view these payslips' });
    }

    const result = await db.query(
      `SELECT p.*, u.first_name, u.last_name
       FROM payslips p
       JOIN employees e ON p.employee_id = e.employee_id
       JOIN users u ON e.user_id = u.user_id
       WHERE p.employee_id = $1
       ORDER BY p.pay_period_end DESC, p.payslip_id DESC`,
      [parsedEmployeeId]
    );

    res.json({ payslips: result.rows });
  } catch (error) {
    sendError(res, 500, 'Could not load payslips', error)
  }
}

// generates a payslip PDF from requested data
async function generatePayslipPDFFromRequest(req, res) {
  try {
    const {
      firstName,
      lastName,
      address,
      businessName,
      taxCode,
      irdNumber,
      kiwisaverRate,
      hourlyRate,
      hoursWorked,
      payPeriodStart,
      payPeriodEnd,
      employmentType,
      shifts,
      publicHolidayRegion,
    } = req.body;
    const hourlyRateNumber = toFiniteNumber(hourlyRate)
    const hoursWorkedNumber = toFiniteNumber(hoursWorked)
    const kiwiSaverNumber = kiwisaverRate == null || kiwisaverRate === ''
      ? null
      : toFiniteNumber(kiwisaverRate)

    if (
      !String(firstName || '').trim()
      || !String(lastName || '').trim()
      || hourlyRateNumber == null
      || hoursWorkedNumber == null
      || !isValidDateRange(payPeriodStart, payPeriodEnd)
    ) {
      return res.status(400).json({
        error: 'firstName, lastName, hourlyRate, hoursWorked and a valid pay period are required'
      });
    }

    if (hourlyRateNumber <= 0 || hoursWorkedNumber < 0) {
      return res.status(400).json({ error: 'Hourly rate and hours worked must be valid positive values' })
    }

    if (kiwiSaverNumber != null && (kiwiSaverNumber < 0 || kiwiSaverNumber > 10)) {
      return res.status(400).json({ error: 'KiwiSaver rate must be between 0 and 10 percent' })
    }

    if (!['permanent', 'casual'].includes(employmentType || 'permanent')) {
      return res.status(400).json({ error: 'Employment type must be permanent or casual' })
    }

    const engineEmployee = {
      hourlyRate: hourlyRateNumber,
      employmentType: employmentType || 'permanent',
      wageType: 'adult',
      usualDaysPerWeek: 5,
      taxCode: taxCode || 'M',
      kiwisaverRate: kiwiSaverNumber,
    };
    
    // TEMP PLACEHOLDERS 
    const holidayRegion = String(publicHolidayRegion || 'Canterbury')
    const { regularHours, publicHolidays } =
      calculateShiftHours(shifts, holidayRegion, hoursWorkedNumber)
    const enginePayPeriod = {
      regularHours,
      overtimeHours: 0,
      publicHolidays,
      leaveDaysTaken: 0,
      owp: hourlyRateNumber * 40,
      awe: hourlyRateNumber * 40,
    };

    let result;
    try {
      result = calcPayRun(engineEmployee, enginePayPeriod, { ytdGross: 0, ytdPAYE: 0, ytdKiwiSaver: 0 });
    } catch (wageError) {
      return res.status(400).json({ error: wageError.message });
    }

    const payslipData = buildPayslipData({
      businessName,
      firstName,
      lastName,
      address,
      hourlyRate: hourlyRateNumber,
      taxCode: taxCode || 'M',
      irdNumber,
      payPeriodStart,
      payPeriodEnd,
      regularHours,
      result,
      employmentType: employmentType || 'permanent',
    })

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=payslip-${safeDownloadName(lastName)}.pdf`);

    generatePayslipPDF(payslipData, res);

  } catch (error) {
    if (!res.headersSent) {
      sendError(res, 500, 'Could not generate the payslip', error)
    } else {
      console.error('generatePayslipPDF stream failed', error)
      res.end()
    }
  }
}

module.exports = {
  createPayRun,
  listPayRuns,
  getPayslips,
  downloadPayslipPDF,
  generatePayslipPDFFromRequest,
};