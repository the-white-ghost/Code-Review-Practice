const fs = require('fs');
const path = require('path');
const diff = require('diff');

class CodeManager {
    constructor() {
        this.codesDir = path.join(__dirname, 'codes');
        this.codes = [];
        this.loadCodes();
    }

    loadCodes() {
        try {
            const vulnerabilitiesPath = path.join(this.codesDir, 'vulnerabilities.json');
            const content = fs.readFileSync(vulnerabilitiesPath, 'utf8');
            const data = JSON.parse(content);
            this.codes = data.vulnerabilities;
        } catch (error) {
            this.codes = [];
        }
    }

    getNextCode() {
        if (this.codes.length === 0) {
            this.loadCodes(); // Try to reload if empty
        }
        
        if (this.codes.length === 0) {
            return null;
        }

        // Get a random index
        const randomIndex = Math.floor(Math.random() * this.codes.length);
        return this.codes[randomIndex];
    }

    getCurrentCode() {
        if (this.codes.length === 0) {
            this.loadCodes(); // Try to reload if empty
        }
        
        if (this.codes.length === 0) {
            return null;
        }

        // Get a random index
        const randomIndex = Math.floor(Math.random() * this.codes.length);
        return this.codes[randomIndex];
    }

    generateDiff(originalCode, fixedCode) {
        // Normalize line endings and ensure we have strings
        originalCode = String(originalCode).replace(/\r\n/g, '\n');
        fixedCode = String(fixedCode).replace(/\r\n/g, '\n');
        
        // Split into lines and trim each line
        const originalLines = originalCode.split('\n').map(line => line.trim());
        const fixedLines = fixedCode.split('\n').map(line => line.trim());
        
        const highlightedDiff = {
            original: [],
            fixed: []
        };
        
        // Find lines that exist in original but not in fixed (removed)
        originalLines.forEach(line => {
            if (line && !fixedLines.includes(line)) {
                highlightedDiff.original.push({
                    code: line,
                    type: 'removed'
                });
            } else if (line) {
                highlightedDiff.original.push({
                    code: line,
                    type: 'unchanged'
                });
            }
        });
        
        // Find lines that exist in fixed but not in original (added)
        fixedLines.forEach(line => {
            if (line && !originalLines.includes(line)) {
                highlightedDiff.fixed.push({
                    code: line,
                    type: 'added'
                });
            } else if (line) {
                highlightedDiff.fixed.push({
                    code: line,
                    type: 'unchanged'
                });
            }
        });
        
        return highlightedDiff;
    }
}

// Create and export a single instance
const codeManager = new CodeManager();
module.exports = codeManager; 