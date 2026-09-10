const { readdirSync, readFileSync } = require('node:fs');
if (process.env.CONTEXT !== 'production') throw new Error('Production artifact verification requires CONTEXT=production');
const file = readdirSync('./dist/_expo/static/js/web').find((name) => name.endsWith('.js'));
if (!file) throw new Error('Production web bundle not found');
const bundle = readFileSync('./dist/_expo/static/js/web/' + file, 'utf8');
if (bundle.includes('IPM Staging') || !bundle.includes('IPM App')) throw new Error('Production bundle has invalid environment label');
console.log('Production bundle environment guard passed');
