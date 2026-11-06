import { jsPDF } from 'jspdf'
import type { DashboardDetailsResult } from './dashboard-details'

interface ReportOptions {
  title: string
  clinic: string
  period: string
  scope: string[]
  result: string
  resultDetail?: string
  rule: string
  rows: string[][]
  columns: DashboardDetailsResult['columns']
  logo?: Uint8Array
  generatedAt: string
}

export function makeDashboardReport(report: ReportOptions) {
  const wide = report.columns.length > 5
  const pdf = new jsPDF({ orientation: wide ? 'landscape' : 'portrait', unit: 'mm', format: 'a4', compress: true })
  const pageWidth = pdf.internal.pageSize.getWidth()
  const pageHeight = pdf.internal.pageSize.getHeight()
  const margin = 15
  const width = pageWidth - margin * 2
  const navy = '#0F1E36'
  const ink = '#182941'
  const slate = '#475D78'
  const line = '#D8E2EE'
  const pale = '#F3F6FA'
  const orange = '#F97316'
  const total = new Intl.NumberFormat('pt-BR').format(report.rows.length)
  const right = pageWidth - margin
  const bottom = pageHeight - 23
  let y = 0

  pdf.setProperties({ title: report.title + ' | SellClin', subject: 'Dashboard detalhado', creator: 'SellClin' })

  function type(size: number, color = ink, weight: 'normal' | 'bold' = 'normal') {
    pdf.setFont('helvetica', weight)
    pdf.setFontSize(size)
    pdf.setTextColor(color)
  }

  function lines(value: string, maxWidth: number): string[] {
    return pdf.splitTextToSize(value.replace(/\r\n?/g, '\n'), maxWidth)
  }

  function header(first: boolean) {
    pdf.setFillColor(orange)
    pdf.rect(margin, 12, 10, 0.9, 'F')
    if (report.logo) {
      const size = pdf.getImageProperties(report.logo)
      const factor = Math.min(29 / size.width, 9 / size.height)
      pdf.addImage(report.logo, 'PNG', margin, 17, size.width * factor, size.height * factor, 'sellclin')
    } else {
      type(17, navy, 'bold')
      pdf.text('SellClin', margin, 24)
    }
    type(8.5, slate)
    pdf.text('DASHBOARD DETALHADO', right, 22, { align: 'right' })
    pdf.setDrawColor(line)
    pdf.line(margin, 30, right, 30)
    type(first ? 25 : 14, navy, 'bold')
    const title = lines(report.title, width)
    pdf.text(title, margin, 40, { lineHeightFactor: 1.08 })
    y = 41 + (title.length - 1) * (first ? 9.5 : 5.5)
    type(10, slate)
    const clinic = lines(report.clinic + '  /  ' + report.period, width)
    pdf.text(clinic, margin, y + 5, { lineHeightFactor: 1.18 })
    y += 8 + clinic.length * 4.2
  }

  header(true)
  type(10, slate)
  const context = report.scope.flatMap(item => lines(item, width))
  if (context.length) {
    pdf.text(context, margin, y, { lineHeightFactor: 1.2 })
    y += context.length * 4.25 + 4
  }

  type(22, navy, 'bold')
  const resultLines = lines(report.result, width - 14)
  const summaryHeight = 20 + resultLines.length * 8
  pdf.setFillColor(pale)
  pdf.roundedRect(margin, y, width, summaryHeight, 2.6, 2.6, 'F')
  type(8.5, slate, 'bold')
  pdf.text('RESULTADO DO INDICADOR', margin + 6, y + 7)
  type(22, navy, 'bold')
  pdf.text(resultLines, margin + 6, y + 17, { lineHeightFactor: 1.03 })
  type(9, slate)
  const recordCount = total + (report.rows.length === 1 ? ' registro neste relatório' : ' registros neste relatório')
  pdf.text(report.resultDetail ? report.resultDetail + '  /  ' + recordCount : recordCount, margin + 6, y + summaryHeight - 4)
  y += summaryHeight + 7
  type(9.5, slate)
  const rule = lines(report.rule, width)
  pdf.text(rule, margin, y, { lineHeightFactor: 1.2 })
  y += rule.length * 4 + 8

  const weights = report.columns.map((column, index) => column.format === 'money' ? 0.95
    : column.format === 'dateTime' ? 1.1 : index === 0 ? 1.4 : 1)
  const weightSum = weights.reduce((sum, weight) => sum + weight, 0)
  const widths = weights.map(weight => width * weight / weightSum)
  const starts = widths.map((_, i) => margin + widths.slice(0, i).reduce((sum, cellWidth) => sum + cellWidth, 0))

  function tableHeader() {
    type(8.5, '#FFFFFF', 'bold')
    const labels = report.columns.map((column, i) => lines(column.label, widths[i] - 6))
    const height = Math.max(10, Math.max(...labels.map(label => label.length)) * 3.7 + 5)
    pdf.setFillColor(navy)
    pdf.roundedRect(margin, y, width, height, 1.6, 1.6, 'F')
    labels.forEach((label, i) => {
      const moneyColumn = report.columns[i].format === 'money'
      pdf.text(label, starts[i] + (moneyColumn ? widths[i] - 3 : 3), y + 5.1,
        { align: moneyColumn ? 'right' : 'left', lineHeightFactor: 1.12 })
    })
    y += height
  }

  if (report.rows.length) tableHeader()
  else {
    type(10, slate)
    pdf.text('Nenhum registro corresponde ao recorte selecionado.', margin, y)
  }

  report.rows.forEach((row, index) => {
    const lineHeight = 4
    const cells = report.columns.map((_, i) => {
      type(9.5, ink, i === 0 ? 'bold' : 'normal')
      return lines(row[i] ?? '-', widths[i] - 6)
    })
    const maxLines = Math.max(...cells.map(cell => cell.length))
    // Keep ordinary records together and continue very long values on later pages.
    if (y + maxLines * lineHeight + 5 > bottom && maxLines <= Math.floor((bottom - 65) / lineHeight)) {
      pdf.addPage()
      header(false)
      tableHeader()
    }
    for (let offset = 0; offset < maxLines;) {
      const capacity = Math.floor((bottom - y - 5) / lineHeight)
      if (capacity < 1) {
        pdf.addPage()
        header(false)
        tableHeader()
        continue
      }
      const count = Math.min(maxLines - offset, capacity)
      const height = count * lineHeight + 5
      if (index % 2 === 0) {
        pdf.setFillColor(pale)
        pdf.rect(margin, y, width, height, 'F')
      }
      cells.forEach((cell, i) => {
        const chunk = cell.slice(offset, offset + count)
        if (!chunk.length) return
        const isMoney = report.columns[i].format === 'money'
        type(9.5, ink, i === 0 ? 'bold' : 'normal')
        pdf.text(chunk, starts[i] + (isMoney ? widths[i] - 3 : 3), y + 5.1,
          { align: isMoney ? 'right' : 'left', lineHeightFactor: 1.19 })
      })
      y += height
      pdf.setDrawColor(line)
      pdf.line(margin, y, right, y)
      offset += count
    }
  })

  const pages = pdf.getNumberOfPages()
  for (let page = 1; page <= pages; page++) {
    pdf.setPage(page)
    pdf.setDrawColor(line)
    pdf.line(margin, pageHeight - 17, right, pageHeight - 17)
    type(8, slate)
    pdf.text('SellClin  /  Emitido em ' + report.generatedAt, margin, pageHeight - 11)
    pdf.text('Página ' + page + ' de ' + pages, right, pageHeight - 11, { align: 'right' })
  }
  return pdf
}
