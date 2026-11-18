import api from './api';

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