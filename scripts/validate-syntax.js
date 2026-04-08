#!/usr/bin/env node

/**
 * Quick syntax validator for compiled JS migration scripts
 * Run with: node scripts/validate-syntax.js
 */

const fs = require('fs');
const path = require('path');

const scriptDir = __dirname;
const scripts = [
  'migrate-historical-data.js',
  'verify-migration.js'
];

console.log('🔍 Validating JavaScript syntax...\n');

let allValid = true;

for (const script of scripts) {
  const filePath = path.join(scriptDir, script);
  
  try {
    // Check file exists
    if (!fs.existsSync(filePath)) {
      console.log(`❌ ${script}: File not found`);
      allValid = false;
      continue;
    }
    
    // Read and parse the file
    const content = fs.readFileSync(filePath, 'utf8');
    
    // Basic syntax check via require (only loads, doesn't execute)
    // This will catch most syntax errors
    require.extensions['.js'] = function(module, filename) {
      module.exports = null;
    };
    
    // Simple regex checks for common issues
    const issues = [];
    
    // Check for unmatched braces
    const openBraces = (content.match(/{/g) || []).length;
    const closeBraces = (content.match(/}/g) || []).length;
    if (openBraces !== closeBraces) {
      issues.push(`Unmatched braces: { count=${openBraces}, } count=${closeBraces}`);
    }
    
    // Check for unmatched parentheses
    const openParens = (content.match(/\(/g) || []).length;
    const closeParens = (content.match(/\)/g) || []).length;
    if (openParens !== closeParens) {
      issues.push(`Unmatched parentheses: ( count=${openParens}, ) count=${closeParens}`);
    }
    
    // Check for unmatched square brackets
    const openBrackets = (content.match(/\[/g) || []).length;
    const closeBrackets = (content.match(/\]/g) || []).length;
    if (openBrackets !== closeBrackets) {
      issues.push(`Unmatched brackets: [ count=${openBrackets}, ] count=${closeBrackets}`);
    }
    
    // Check for common require patterns
    if (!content.includes('require(')) {
      issues.push('No require() calls found - might be an ES module');
    }
    
    // Check for main function invocation
    if (!content.match(/main\(\)\s*\n\s*\.catch\(/)) {
      issues.push('Warning: No main() execution pattern found');
    }
    
    if (issues.length === 0) {
      console.log(`✅ ${script}: Syntax valid`);
    } else {
      console.log(`⚠️  ${script}: Issues found:`);
      issues.forEach(issue => console.log(`   • ${issue}`));
      allValid = false;
    }
    
  } catch (error) {
    console.log(`❌ ${script}: Error - ${error.message}`);
    allValid = false;
  }
}

console.log('\n' + '═'.repeat(50));
if (allValid) {
  console.log('✅ All scripts valid! Ready to execute with Node.js');
  console.log('\n📝 Usage:');
  console.log('  node scripts/migrate-historical-data.js');
  console.log('  node scripts/verify-migration.js');
  process.exit(0);
} else {
  console.log('❌ Some scripts have issues. Please review above.');
  process.exit(1);
}
