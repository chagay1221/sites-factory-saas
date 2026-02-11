const fs = require('fs');
const path = require('path');

try {
    const raw = fs.readFileSync('lint.json', 'utf8');
    const start = raw.indexOf('[');
    if (start === -1) throw new Error('No JSON start');

    const json = JSON.parse(raw.substring(start));
    let count = 0;

    // cwd is where we run node from
    const cwd = process.cwd();

    const grouped = {};
    json.forEach(f => {
        const relPath = path.relative(cwd, f.filePath);
        if (f.messages.length > 0) {
            grouped[relPath] = f.messages.map(m => `${m.line}:${m.column} ${m.ruleId.replace('@typescript-eslint/', '')} - ${m.message}`);
            count += f.messages.length;
        }
    });

    Object.keys(grouped).forEach(file => {
        console.log(`\n=== ${file} ===`);
        grouped[file].forEach(m => console.log(m));
    });

    console.log(`\nTotal: ${count}`);
} catch (e) {
    console.error(e.message);
}
