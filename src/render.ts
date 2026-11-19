import type { ConfigReport } from './config.ts';
import type { UrlCheck } from './url.ts';

export function renderConfig(report: ConfigReport): string {
  const lines: string[] = [];
  lines.push(report.file ? `Config file: ${report.file}` : 'Config file: none (defaults only)');
  for (const o of report.overrides) lines.push(`Override: ${o.name} sets ${o.path}`);
  if (report.issues.length > 0) {
    const n = report.issues.length;
    lines.push(`Invalid (${n === 1 ? '1 issue' : `${n} issues`}):`);
    for (const issue of report.issues)
      lines.push(`  - ${issue.path || '(root)'}: ${issue.message}`);
  } else if (report.config) {
    lines.push('Valid. Resolved configuration:');
    lines.push(JSON.stringify(report.config, null, 2));
  }
  return lines.join('\n');
}

export function renderUrl(check: UrlCheck): string {
  const lines = [`${check.allowed ? 'ALLOWED' : 'BLOCKED'}  ${check.input}`];
  for (const reason of check.reasons) lines.push(`  - ${reason}`);
  return lines.join('\n');
}
