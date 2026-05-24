import fs from 'fs';

const file = '/root/.openclaw/workspace/cv-react/src/App.jsx';
let content = fs.readFileSync(file, 'utf8');
const lines = content.split('\n');

// Find section boundaries
const eduStart = 696; // {/* Education */}
const eduEnd = 784;   // </section>
const expStart = 786; // {/* Experience */}
const expEnd = 845;   // </section>

// Extract sections (0-based indices)
const educationSection = lines.slice(eduStart - 1, eduEnd);
const experienceSection = lines.slice(expStart - 1, expEnd);

// Rebuild
const before = lines.slice(0, eduStart - 1);
const between = lines.slice(eduEnd, expStart - 1);
const after = lines.slice(expEnd);

const newLines = [
  ...before,
  '      {/* Experience */}',
  ...experienceSection.slice(1),
  ...between,
  '      {/* Education */}',
  ...educationSection.slice(1),
  ...after
];

fs.writeFileSync(file, newLines.join('\n'));
console.log('Swapped: Experience before Education');
