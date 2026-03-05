import fs from 'fs';

export function renderTemplate(templatePath: string, variables: Record<string, string>): string {
  let html = fs.readFileSync(templatePath, 'utf-8');

  for (const [key, value] of Object.entries(variables)) {
    html = html.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
  }

  return html;
}
