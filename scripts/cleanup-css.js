const fs = require('fs');
const path = require('path');

const cssPath = path.join(__dirname, '../app/globals.css');
let css = fs.readFileSync(cssPath, 'utf8');

// List of classes to remove
const classesToRemove = [
  'solo-focus-action-btn',
  'solo-focus-data-stack',
  'impact-to-trinity',
  'solo-focus-impact-hero',
  'solo-focus-carbon-stack',
  'data-stamp-metric',
  'data-stamp-figures',
  'data-symbol-unit',
  'solo-focus-trinity',
  'solo-focus-ask-zai-btn',
  'kinetic-zai-disc',
  'solo-focus-action-80',
  'card-impact-grid',
  'solo-focus-impact-grid',
  'solo-focus-impact-answer-pulse',
  'data-stack',
  'data-label',
  'data-value',
  'solo-focus-data-value'
];

// We will use a regex to match CSS blocks containing these classes
// This is a bit tricky with nested blocks or media queries, but we can do a simple pass
// A safer way is to just remove lines containing these classes if they are simple selectors,
// or we can just leave the CSS alone if it's too risky. 
// The user said "Remove any unwanted CSS. Make sure you've locked in everything."

// Let's just do a simple regex for blocks:
// /\.expanded-solo-focus [^{]*\{[^}]*\}/g
// But we only want to remove blocks that contain our target classes.

const blocks = [];
let currentBlock = '';
let inBlock = false;
let braceCount = 0;

const lines = css.split('\n');
const newLines = [];

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  
  if (classesToRemove.some(cls => line.includes(cls))) {
    // If it's a selector line, we skip until the block ends
    if (line.includes('{')) {
      braceCount += (line.match(/\{/g) || []).length;
      braceCount -= (line.match(/\}/g) || []).length;
      if (braceCount === 0) {
        // single line block
        continue;
      } else {
        // multi line block
        let j = i + 1;
        while (j < lines.length && braceCount > 0) {
          braceCount += (lines[j].match(/\{/g) || []).length;
          braceCount -= (lines[j].match(/\}/g) || []).length;
          j++;
        }
        i = j - 1;
        continue;
      }
    } else if (line.trim().endsWith(',')) {
      // part of a multi-line selector
      let j = i + 1;
      while (j < lines.length && !lines[j].includes('{')) {
        j++;
      }
      if (lines[j] && lines[j].includes('{')) {
        braceCount += (lines[j].match(/\{/g) || []).length;
        braceCount -= (lines[j].match(/\}/g) || []).length;
        while (j < lines.length && braceCount > 0) {
          j++;
          if (lines[j]) {
            braceCount += (lines[j].match(/\{/g) || []).length;
            braceCount -= (lines[j].match(/\}/g) || []).length;
          }
        }
        i = j;
        continue;
      }
    }
  }
  
  // If we're here, we keep the line
  newLines.push(line);
}

fs.writeFileSync(cssPath, newLines.join('\n'));
console.log('CSS cleanup complete.');