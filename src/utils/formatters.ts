export function cleanReportText(text: string | null | undefined): string {
  if (!text) return '';
  return text.replace(/\s*\[(?:daily_report_id|report_id|id)\s*:\s*[^\]]+\]/gi, '').trim();
}
