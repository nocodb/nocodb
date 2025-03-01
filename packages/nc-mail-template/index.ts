import { existsSync, rmSync, mkdirSync, readdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { render } from '@react-email/render';
import decode from 'html-entities-decoder';

const outputDir = './dist';
if (existsSync(outputDir)) {
  rmSync(outputDir, { recursive: true });
}
mkdirSync(outputDir, { recursive: true });

const exportString = 'export default `';

async function renderEmailTemplates() {
  const emailsDir = './emails';

  const files = readdirSync(emailsDir);

  for (const file of files) {
    if (file.endsWith('.tsx')) {
      try {
        const templatePath = join(process.cwd(), emailsDir, file);
        const EmailTemplate = (await import(templatePath)).default;

        const html = await render(EmailTemplate());

        const decodeHtml= decode(html);

        const outputFilename = file.replace('.tsx', '.ts');
        const outputPath = join(outputDir, outputFilename);

        writeFileSync(outputPath, exportString + decodeHtml + "`");

        console.log(`Rendered ${file} to ${outputPath}`);
      } catch (error) {
        console.error(`Error rendering ${file}:`, error);
      }
    }
  }
}

renderEmailTemplates()
  .then(() => console.log('Email rendering complete!'))
  .catch(err => console.error('Error in email rendering process:', err));