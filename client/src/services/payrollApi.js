import api from './api';
import { jsPDF } from 'jspdf';

function downloadPdfBlob(blob, fileName) {
  const url = window.URL.createObjectURL(
    new Blob([blob], { type: 'application/pdf' }),
  )
  const link = document.createElement('a')
  link.href = url
  link.setAttribute('download', fileName)
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.setTimeout(() => window.URL.revokeObjectURL(url), 1000)
}

// generates the payslip form and triggers the browser download
export async function generatePayslip(formData) {
  const token = localStorage.getItem('token')
  if (!token) {
    const doc = new jsPDF()
    const regularHours = Number(formData.hoursWorked || 0)
    const hourlyRate = Number(formData.hourlyRate || 0)
    const grossPay = regularHours * hourlyRate
    const kiwiSaverRate = Number(formData.kiwisaverRate || 0) / 100
    const kiwiSaver = grossPay * kiwiSaverRate
    const netPay = grossPay - kiwiSaver

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(18)
    doc.text(String(formData.businessName || 'Vizura Payslip'), 20, 20)
    doc.setFontSize(11)
    doc.setFont('helvetica', 'normal')
    doc.text(`Employee: ${formData.firstName || ''} ${formData.lastName || ''}`.trim(), 20, 32)
    doc.text(`Pay period: ${formData.payPeriodStart || ''} to ${formData.payPeriodEnd || ''}`, 20, 40)
    doc.text(`Employment type: ${formData.employmentType || 'permanent'}`, 20, 48)
    doc.text(`Tax code: ${formData.taxCode || 'M'}`, 20, 56)
    doc.text(`Hourly rate: NZD ${hourlyRate.toFixed(2)}`, 20, 68)
    doc.text(`Hours worked: ${regularHours.toFixed(2)}`, 20, 76)
    doc.text(`Gross pay: NZD ${grossPay.toFixed(2)}`, 20, 88)
    doc.text(`KiwiSaver: NZD ${kiwiSaver.toFixed(2)}`, 20, 96)
    doc.text(`Net pay: NZD ${netPay.toFixed(2)}`, 20, 104)
    doc.save(`payslip-${String(formData.lastName || 'employee').replace(/[^a-z0-9_-]/gi, '-')}.pdf`)
    return
  }

  const response = await api.post('/payroll/payslips/generate', formData, {
    responseType: 'blob',
  })
  downloadPdfBlob(response.data, 'payslip.pdf')
}

// creates a new pay run for selected employee and pay period
export const createPayRun = async (employeeIds, payPeriod) => {
  const response = await api.post('/payroll/payruns', { employeeIds, payPeriod });
  return response.data;
};

// gets latest pay run
export const getPayRuns = async () => {
  const response = await api.get('/payroll/payruns');
  return response.data.payRuns;
};

// gets payslips for a specific employee
export const getEmployeePayslips = async (employeeId) => {
  const response = await api.get(`/payroll/payslips/${employeeId}`);
  return response.data.payslips;
};

// downloads a specific payslip PDF by ID
export const downloadPayslipPDF = async (payslipId) => {
  const response = await api.get(`/payroll/payslips/${payslipId}/pdf`, {
    responseType: 'blob',
  });
  downloadPdfBlob(response.data, `payslip-${payslipId}.pdf`)
};