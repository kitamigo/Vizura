const db = require('../config/db');
const { calcPayRun } = require('../utils/payrollEngine');
const { isPublicHoliday } = require('../utils/nzHolidays');
const { generatePayslipPDF } = require('../utils/payslipPDF');

async function createPayRun(req, res) {
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

      // Fetch YTD values 
      let ytdGross = 0;
      let ytdPAYE = 0;
      let ytdKiwiSaver = 0;
      const ytdResult = await db.query(
        `SELECT ytd_gross, ytd_paye, ytd_kiwisaver FROM payslips
         WHERE employee_id = $1 ORDER BY payslip_id DESC LIMIT 1`,
        [emp.employee_id]
      );
      if (ytdResult.rows.length) {
        ytdGross = parseFloat(ytdResult.rows[0].ytd_gross) || 0;
        ytdPAYE = parseFloat(ytdResult.rows[0].ytd_paye) || 0;
        ytdKiwiSaver = parseFloat(ytdResult.rows[0].ytd_kiwisaver) || 0;
      }

      // wage error handling
      let result;
      try {
        result = calcPayRun(engineEmployee, enginePayPeriod, { ytdGross, ytdPAYE, ytdKiwiSaver });
      } catch (wageError) {
        results.push({ employee_id: emp.employee_id, name: emp.name, error: wageError.message });
        continue;
      }


      const newYtdGross = ytdGross + result.grossPay;
      const newYtdPAYE = ytdPAYE + result.payeTax;
      const newYtdKiwiSaver = ytdKiwiSaver + result.kiwisaverEmployee;

      const breakdown = {
        regPay: result.regPay,
        totalHolidayPay: result.totalHolidayPay,
        leavePay: result.leavePay,
        holidayPayAddition: result.holidayPayAddition,
        employmentType: emp.contract_type,
        regularHours,
      };

      const persistResult = await db.query(
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

    res.status(201).json({ results });

  } catch (error) {
    console.error('createPayRun error:', error.message);
    res.status(500).json({ error: error.message });
  }
}

// - Download Payslip PDF - //
async function downloadPayslipPDF(req, res) {
  try {
    const { id } = req.params;

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
      },
      engineOutput: {
        regPay: breakdown.regPay || 0,
        totalHolidayPay: breakdown.totalHolidayPay || 0,
        leavePay: breakdown.leavePay || 0,
        holidayPayAddition: breakdown.holidayPayAddition || 0,
        employmentType: breakdown.employmentType || slip.contract_type,
        grossPay,
        payeTax,
        kiwisaverEmployee,
        kiwisaverEmployer,
        totalDeductions,
        netPay,
      },
      ytdEarnings: {
        gross: parseFloat(slip.ytd_gross) - grossPay,
        paye: parseFloat(slip.ytd_paye) - payeTax,
        kiwisaver: parseFloat(slip.ytd_kiwisaver) - kiwisaverEmployee,
      },
    };

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=payslip-${parsedId}.pdf`);

    generatePayslipPDF(payslipData, res);

  } catch (error) {
    console.error('downloadPayslipPDF error:', error.message);
    res.status(500).json({ error: error.message });
  }
}

async function listPayRuns(req, res) {
  res.json({ payRuns: [] });
}

async function getPayslips(req, res) {
  res.json({ payslips: [] });
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
    } = req.body;

    if (!firstName || !lastName || !hourlyRate || !hoursWorked || !payPeriodStart || !payPeriodEnd) {
      return res.status(400).json({
        error: 'firstName, lastName, hourlyRate, hoursWorked, payPeriodStart and payPeriodEnd are required'
      });
    }

    const engineEmployee = {
      hourlyRate: parseFloat(hourlyRate),
      employmentType: employmentType || 'permanent',
      wageType: 'adult',
      usualDaysPerWeek: 5,
      taxCode: taxCode || 'M',
      kiwisaverRate: kiwiSaverNumber,
    };

    const enginePayPeriod = {
      overtimeHours: 0,
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

    const payslipData = {
      business: {
        businessName: businessName || '',
      },
      employee: {
        firstName,
        lastName,
        address,
        hourlyRate: parseFloat(hourlyRate),
        taxCode: taxCode || 'M',
        irdNumber,
      },
      period: {
        start: payPeriodStart,
        end: payPeriodEnd,
      },
      payPeriodInput: {
        regularHours: parseFloat(hoursWorked),
      },
      engineOutput: {
        regPay: result.regPay,
        totalHolidayPay: result.totalHolidayPay,
        leavePay: result.leavePay,
        holidayPayAddition: result.holidayPayAddition,
        employmentType: employmentType || 'permanent',
        grossPay: result.grossPay,
        payeTax: result.payeTax,
        kiwisaverEmployee: result.kiwisaverEmployee,
        kiwisaverEmployer: result.kiwisaverEmployer,
        totalDeductions: result.totalDeductions,
        netPay: result.netPay,
      },
      ytdEarnings: {
        gross: 0,
        paye: 0,
        kiwisaver: 0,
      },
    };

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