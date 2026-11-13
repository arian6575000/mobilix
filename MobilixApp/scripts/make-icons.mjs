// Generates the Mobilix icons (a phone outline with a scan corner mark on indigo) so no binary assets need to live in git.
// Replace assets/*.png with your own artwork any time; this script only creates files that are missing.
import fs from 'node:fs';
import sharp from 'sharp';

fs.mkdirSync('assets', { recursive: true });
const S = 1024;
const INDIGO = '#4F46E5';
const svg = (body) => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}" viewBox="0 0 ${S} ${S}">${body}</svg>`);
const out = (name, body, size = S) => sharp(svg(body)).resize(size, size).png().toFile(`assets/${name}`);

// phone body 300x520 centred, with a notch bar and four scan corners around the screen
const phone = (stroke, fill = 'none', sw = 34) => `
  <rect x="362" y="252" width="300" height="520" rx="64" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"/>
  <rect x="452" y="296" width="120" height="20" rx="10" fill="${stroke}"/>
  <circle cx="512" cy="710" r="22" fill="${stroke}"/>`;
const corner = (c) => `
  <path d="M242 302V262a50 50 0 0 1 50-50h50M782 302V262a50 50 0 0 0-50-50h-50M242 722v40a50 50 0 0 0 50 50h50M782 722v40a50 50 0 0 1-50 50h-50" fill="none" stroke="${c}" stroke-width="26" stroke-linecap="round" opacity="0.6"/>`;

const jobs = {
  'icon.png': `<rect width="${S}" height="${S}" fill="${INDIGO}"/>${phone('#fff')}${corner('#fff')}`,
  'splash-icon.png': `<g transform="translate(512 512) scale(0.9) translate(-512 -512)">${phone(INDIGO)}${corner(INDIGO)}</g>`,
  'android-icon-foreground.png': `<g transform="translate(512 512) scale(0.78) translate(-512 -512)">${phone('#fff')}${corner('#fff')}</g>`,
  'android-icon-background.png': `<rect width="${S}" height="${S}" fill="${INDIGO}"/>`,
  'android-icon-monochrome.png': `<g transform="translate(512 512) scale(0.78) translate(-512 -512)">${phone('#000')}${corner('#000')}</g>`,
};
for (const [n, b] of Object.entries(jobs)) if (!fs.existsSync(`assets/${n}`)) await out(n, b);
if (!fs.existsSync('assets/favicon.png')) await out('favicon.png', jobs['icon.png'], 48);
console.log('icons ready');
