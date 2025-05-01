const { ipcRenderer } = require('electron');
const fs = require('fs');
const path = require('path');
const codeManager = require('./codeManager');

let currentCode = null;
let currentVulnerabilities = [];
let loadedFiles = new Set();
let currentFileData = null; // Store current file data to access hint and answer
let selectedDifficulty = null;
let retryCount = 0;
const MAX_RETRIES = 3;
let allVulnerabilities = [];
let filteredVulnerabilities = [];
const difficultyLabels = ['Beginner', 'Intermediate', 'Advanced'];
let showSavedOnly = false;
let savedVulnerabilitiesList = [];

function showError(message) {
    const errorDiv = document.createElement('div');
    errorDiv.style.color = 'red';
    errorDiv.style.padding = '10px';
    errorDiv.style.margin = '10px 0';
    errorDiv.style.border = '1px solid red';
    errorDiv.style.borderRadius = '4px';
    errorDiv.textContent = message;
    
    const instructionsContent = document.getElementById('instructions-content');
    instructionsContent.insertBefore(errorDiv, instructionsContent.firstChild);
    
    setTimeout(() => errorDiv.remove(), 5000);
}

function displayCode(code, filename, fixedCode = null) {
    if (!code) {
        throw new Error('No code content provided');
    }

    // Clear previous code and remove any existing toggle button
    const codeContent = document.querySelector('.code-content');
    const lineNumbers = document.querySelector('.line-numbers');
    const existingToggle = document.getElementById('code-toggle');
    if (existingToggle) {
        existingToggle.remove();
    }
    codeContent.innerHTML = '';
    lineNumbers.innerHTML = '';

    // Add toggle button if we have fixed code
    if (fixedCode) {
        const toggleButton = document.createElement('button');
        toggleButton.id = 'code-toggle';
        toggleButton.innerHTML = 'Show Original'; // Initial state shows fixed code
        toggleButton.style.position = 'absolute';
        toggleButton.style.top = '10px';
        toggleButton.style.right = '10px';
        toggleButton.style.padding = '5px 10px';
        toggleButton.style.border = 'none';
        toggleButton.style.background = 'none';
        toggleButton.style.fontSize = '12px';
        toggleButton.style.cursor = 'pointer';
        toggleButton.style.opacity = '0.7';
        toggleButton.style.transition = 'opacity 0.2s';
        toggleButton.style.color = '#e0e0e0';
        toggleButton.onmouseover = () => toggleButton.style.opacity = '1';
        toggleButton.onmouseout = () => toggleButton.style.opacity = '0.7';
        codeContent.parentElement.style.position = 'relative';
        codeContent.parentElement.appendChild(toggleButton);

        // Generate diff between original and fixed code
        const diffResult = codeManager.generateDiff(code, fixedCode);

        // Store both versions of the code with their diffs
        window.currentCodeState = {
            original: {
                code: code,
                diff: diffResult.original
            },
            fixed: {
                code: fixedCode,
                diff: diffResult.fixed
            },
            showingFixed: true
        };

        // Add toggle event listener
        toggleButton.addEventListener('click', () => {
            const state = window.currentCodeState;
            state.showingFixed = !state.showingFixed;
            toggleButton.innerHTML = state.showingFixed ? 'Show Original' : 'Show Fixed';
            
            // Clear and redraw with appropriate code
            codeContent.innerHTML = '';
            lineNumbers.innerHTML = '';
            renderCodeLines(state.showingFixed ? state.fixed : state.original);

            // Update the filename in the tab
            const fileTab = document.querySelector('.file-tab');
            fileTab.textContent = state.showingFixed ? 
                currentCode.filename + ' (Fixed)' : 
                currentCode.filename;
        });

        // Initial render with fixed code
        renderCodeLines(window.currentCodeState.fixed);
    } else {
        // If no fixed code, just render the original code
        renderCodeLines({ code: code, diff: [] });
    }

    // Update filename in the tab
    const fileTab = document.querySelector('.file-tab');
    fileTab.textContent = filename;
}

function renderCodeLines(codeData) {
    const codeContent = document.querySelector('.code-content');
    const lineNumbers = document.querySelector('.line-numbers');
    
    // Split code into lines
    const lines = codeData.code.split('\n');
    const diffLines = codeData.diff;
    
    console.log('Rendering lines:', lines.length);
    console.log('Diff lines:', diffLines);
    
    // Add line numbers and code content
    lines.forEach((line, index) => {
        const lineNumber = document.createElement('div');
        lineNumber.textContent = index + 1;
        lineNumber.style.height = '24px';
        lineNumber.style.lineHeight = '24px';
        lineNumbers.appendChild(lineNumber);

        const codeLine = document.createElement('div');
        codeLine.className = 'code-line';
        
        // Check if this line has a diff
        const diffLine = diffLines.find(d => {
            // For removed lines, check if the line exists in the original code
            if (d.type === 'removed') {
                return d.code.trim() === line.trim();
            }
            // For added lines, check if the line exists in the fixed code
            if (d.type === 'added') {
                return d.code.trim() === line.trim();
            }
            return false;
        });
        
        if (diffLine) {
            console.log('Found diff line:', diffLine);
            if (diffLine.type === 'removed') {
                codeLine.classList.add('removed-line');
            } else if (diffLine.type === 'added') {
                codeLine.classList.add('added-line');
            }
        }
        
        // Preserve spaces and tabs
        const escapedLine = line
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
        
        codeLine.innerHTML = escapedLine;
        codeContent.appendChild(codeLine);
    });
}

function getRandomUnshownFile() {
    const files = fs.readdirSync(path.join(__dirname, 'codes'));
    const jsonFiles = files.filter(file => file.endsWith('.json'));
    
    if (loadedFiles.size >= jsonFiles.length) {
        loadedFiles.clear();
    }
    
    let availableFiles = jsonFiles.filter(file => !loadedFiles.has(file));
    
    // Filter by difficulty if one is selected
    if (selectedDifficulty !== null) {
        availableFiles = availableFiles.filter(file => {
            try {
                const filePath = path.join(__dirname, 'codes', file);
                const content = fs.readFileSync(filePath, 'utf8');
                const fileData = JSON.parse(content);
                // Convert both to numbers for comparison
                const fileDifficulty = parseInt(fileData.difficulty);
                const selectedDiff = parseInt(selectedDifficulty);
                return !isNaN(fileDifficulty) && fileDifficulty === selectedDiff;
            } catch (error) {
                console.error('Error reading file:', error);
                return false;
            }
        });
    }
    
    if (availableFiles.length === 0) {
        // If no files match the filter, show a message and clear the filter
        if (selectedDifficulty !== null) {
            const difficultyLabels = ['Beginner', 'Intermediate', 'Advanced'];
            const difficultyText = difficultyLabels[selectedDifficulty] || 'Unknown';
            showError(`No ${difficultyText} difficulty problems available. Showing all problems.`);
            selectedDifficulty = null;
            // Try again without the filter
            return getRandomUnshownFile();
        }
        return null;
    }
    
    const randomIndex = Math.floor(Math.random() * availableFiles.length);
    const selectedFile = availableFiles[randomIndex];
    loadedFiles.add(selectedFile);
    
    return selectedFile;
}


function showHint(hint) {

    const hintSection = document.getElementById('hint-section');
    const hintContent = document.getElementById('hint-content');
    
    if (!hintSection || !hintContent) {
        console.error('Hint elements not found');
        return;
    }
    
    // Remove any existing timer
    const existingTimer = hintSection.querySelector('.hint-timer');
    if (existingTimer) {
        existingTimer.remove();
    }
    
    // Create new timer
    const hintTimer = document.createElement('div');
    hintTimer.className = 'hint-timer';
    hintSection.appendChild(hintTimer);
    
    hintContent.textContent = hint;
    hintSection.classList.add('visible');
    
    let timeLeft = 15;
    hintTimer.textContent = `Disappears in ${timeLeft}s`;
    
    const timer = setInterval(() => {
        timeLeft--;
        hintTimer.textContent = `Disappears in ${timeLeft}s`;
        
        if (timeLeft <= 0) {
            clearInterval(timer);
            hideHint();
        }
    }, 1000);
}

function hideHint() {
    const hintSection = document.getElementById('hint-section');
    if (!hintSection) return;
    
    const hintTimer = hintSection.querySelector('.hint-timer');
    if (hintTimer) {
        hintTimer.remove();
    }
    hintSection.classList.remove('visible');
}

function updateInstructions() {
    const instructionsContent = document.getElementById('instructions-content');
    if (!currentFileData) {
        showError('No vulnerability data available');
        return;
    }

    const difficultyLabels = ['Beginner', 'Intermediate', 'Advanced'];
    const difficultyText = difficultyLabels[currentFileData.difficulty] || 'Unknown';
    
    instructionsContent.innerHTML = `
        <p>Review the code sample and identify the security vulnerability.</p>
        <div class="difficulty-section">
            <span class="difficulty-icon">⚡</span>
            <span class="difficulty-text">Difficulty: ${difficultyText}</span>
        </div>
        <div class="hint-section" id="hint-section">
            <div class="hint-header">
                <span class="hint-icon">💡</span>
                <h3>Hint</h3>
            </div>
            <div id="hint-content"></div>
        </div>
    `;
}

// Load all vulnerabilities at startup
function loadAllVulnerabilities() {
    try {
        const filePath = path.join(__dirname, 'codes', 'vulnerabilities.json');
        const content = fs.readFileSync(filePath, 'utf8');
        const data = JSON.parse(content);
        allVulnerabilities = data.vulnerabilities || [];
        filteredVulnerabilities = [...allVulnerabilities];
        console.log(`Loaded ${allVulnerabilities.length} vulnerabilities`);
    } catch (error) {
        console.error('Error loading vulnerabilities:', error);
        showError('Error loading vulnerabilities. Please check the file format.');
    }
}

function showDifficultyMessage(difficulty) {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'difficulty-message';
    messageDiv.style.position = 'fixed';
    messageDiv.style.top = '20px';
    messageDiv.style.left = '50%';
    messageDiv.style.transform = 'translateX(-50%)';
    messageDiv.style.padding = '15px 20px';
    messageDiv.style.backgroundColor = '#2d2d2d';
    messageDiv.style.color = '#ecf0f1';
    messageDiv.style.borderRadius = '4px';
    messageDiv.style.boxShadow = '0 0 10px rgba(52, 73, 94, 0.5), 0 0 20px rgba(52, 73, 94, 0.3)';
    messageDiv.style.zIndex = '1000';
    messageDiv.style.transition = 'all 0.3s ease-in-out';
    messageDiv.style.fontSize = '14px';
    messageDiv.style.fontWeight = '500';
    messageDiv.style.letterSpacing = '0.5px';
    messageDiv.style.border = '1px solid #2c3e50';
    
    const difficultyText = difficulty !== null ? difficultyLabels[difficulty] : 'all';
    messageDiv.textContent = `Showing ${difficultyText} difficulty problems`;
    
    document.body.appendChild(messageDiv);
    
    // Fade out and remove after 3 seconds
    setTimeout(() => {
        messageDiv.style.opacity = '0';
        messageDiv.style.transform = 'translateX(-50%) translateY(-10px)';
        setTimeout(() => messageDiv.remove(), 300);
    }, 3000);
}

function updateDifficultyIcon() {
    const difficultyIcon = document.querySelector('.difficulty-item .fas.fa-chart-line');
    if (difficultyIcon) {
        if (selectedDifficulty !== null) {
            difficultyIcon.style.color = '#ff69b4'; // Pink color
            difficultyIcon.style.textShadow = '0 0 10px #ff69b4';
            difficultyIcon.style.animation = 'glow 1.5s ease-in-out infinite alternate';
        } else {
            difficultyIcon.style.color = '#e0e0e0'; // Default color
            difficultyIcon.style.textShadow = '';
            difficultyIcon.style.animation = '';
        }
    }
}

// Update the getRandomVulnerability function to handle saved problems list
async function getRandomVulnerability() {
    let availableVulnerabilities = [...allVulnerabilities];
    
    // First apply difficulty filter if selected
    if (selectedDifficulty !== null) {
        availableVulnerabilities = availableVulnerabilities.filter(v => v.difficulty === selectedDifficulty);
    }
    
    // Then apply saved filter if selected
    if (showSavedOnly) {
        try {
            const savedData = await fs.promises.readFile('saved_vulnerabilities.json', 'utf8');
            const savedVulnerabilities = JSON.parse(savedData);
            
            // Update the saved vulnerabilities list
            savedVulnerabilitiesList = availableVulnerabilities.filter(v => 
                savedVulnerabilities.saved_ids.includes(v.id)
            );
            
            // If we've gone through all saved problems, reset the list
            if (savedVulnerabilitiesList.length === 0) {
                savedVulnerabilitiesList = availableVulnerabilities.filter(v => 
                    savedVulnerabilities.saved_ids.includes(v.id)
                );
            }
            
            // Get the next vulnerability from the saved list
            const nextVulnerability = savedVulnerabilitiesList.shift();
            if (nextVulnerability) {
                return nextVulnerability;
            }
            
            showMessage('No saved problems available. Showing all problems.');
            showSavedOnly = false;
            updateSavedProblemsIcon();
            availableVulnerabilities = [...allVulnerabilities];
            if (selectedDifficulty !== null) {
                availableVulnerabilities = availableVulnerabilities.filter(v => v.difficulty === selectedDifficulty);
            }
        } catch (error) {
            console.error('Error reading saved vulnerabilities:', error);
            showMessage('Error loading saved problems. Showing all problems.');
            showSavedOnly = false;
            availableVulnerabilities = [...allVulnerabilities];
            if (selectedDifficulty !== null) {
                availableVulnerabilities = availableVulnerabilities.filter(v => v.difficulty === selectedDifficulty);
            }
        }
    }

    // If no vulnerabilities match the filter, show a message and clear the filter
    if (availableVulnerabilities.length === 0) {
        if (showSavedOnly) {
            showMessage('No saved problems available. Showing all problems.');
            showSavedOnly = false;
            availableVulnerabilities = [...allVulnerabilities];
            if (selectedDifficulty !== null) {
                availableVulnerabilities = availableVulnerabilities.filter(v => v.difficulty === selectedDifficulty);
            }
        } else if (selectedDifficulty !== null) {
            const difficultyText = difficultyLabels[selectedDifficulty] || 'Unknown';
            showMessage(`No ${difficultyText} difficulty problems available. Showing all problems.`);
            selectedDifficulty = null;
            availableVulnerabilities = [...allVulnerabilities];
        } else {
            showMessage('No more problems available. Resetting the list.');
            availableVulnerabilities = [...allVulnerabilities];
        }
    }

    const randomIndex = Math.floor(Math.random() * availableVulnerabilities.length);
    const selectedVulnerability = availableVulnerabilities[randomIndex];
    
    // Remove the selected vulnerability from the filtered list
    filteredVulnerabilities = filteredVulnerabilities.filter(v => v.id !== selectedVulnerability.id);
    
    return selectedVulnerability;
}

// Update the loadAndDisplayVulnerability function to be async
async function loadAndDisplayVulnerability() {
    try {
        const vulnerability = await getRandomVulnerability();
        if (!vulnerability) {
            showMessage('No more vulnerabilities available.');
            return;
        }

        // Set current vulnerability data
        currentFileData = vulnerability;
        currentCode = vulnerability; // Keep this for backward compatibility
        
        // Display the code
        displayCode(vulnerability.code, vulnerability.filename);
        currentVulnerabilities = [];
        
        // Update instructions after setting all data
        updateInstructions();
        
        // Update save button text
        await updateSaveButtonText();
    } catch (error) {
        console.error('Error loading vulnerability:', error);
        showMessage('Error loading vulnerability. Please try again.');
    }
}

// Add event listener for difficulty changes
document.addEventListener('difficultyChanged', (event) => {
    selectedDifficulty = event.detail.difficulty !== null ? parseInt(event.detail.difficulty) : null;
    
    // Filter vulnerabilities based on difficulty
    if (selectedDifficulty !== null) {
        filteredVulnerabilities = allVulnerabilities.filter(v => v.difficulty === selectedDifficulty);
    } else {
        filteredVulnerabilities = [...allVulnerabilities];
    }
    
    // Show difficulty message
    showDifficultyMessage(selectedDifficulty);
    
    // Update difficulty icon
    updateDifficultyIcon();
    
    // Load a new vulnerability with the selected difficulty
    loadAndDisplayVulnerability();
});

// Add this function to show messages in the same style as difficulty messages
function showMessage(message) {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'difficulty-message';
    messageDiv.style.position = 'fixed';
    messageDiv.style.top = '20px';
    messageDiv.style.left = '50%';
    messageDiv.style.transform = 'translateX(-50%)';
    messageDiv.style.padding = '15px 20px';
    messageDiv.style.backgroundColor = '#2d2d2d';
    messageDiv.style.color = '#ecf0f1';
    messageDiv.style.borderRadius = '4px';
    messageDiv.style.boxShadow = '0 0 10px rgba(52, 73, 94, 0.5), 0 0 20px rgba(52, 73, 94, 0.3)';
    messageDiv.style.zIndex = '1000';
    messageDiv.style.transition = 'all 0.3s ease-in-out';
    messageDiv.style.fontSize = '14px';
    messageDiv.style.fontWeight = '500';
    messageDiv.style.letterSpacing = '0.5px';
    messageDiv.style.border = '1px solid #2c3e50';
    
    messageDiv.textContent = message;
    
    document.body.appendChild(messageDiv);
    
    // Fade out and remove after 3 seconds
    setTimeout(() => {
        messageDiv.style.opacity = '0';
        messageDiv.style.transform = 'translateX(-50%) translateY(-10px)';
        setTimeout(() => messageDiv.remove(), 300);
    }, 3000);
}

// Update the saveCurrentVulnerability function
async function saveCurrentVulnerability() {
    if (!currentFileData) return;

    try {
        // Read existing saved IDs using fs.promises
        const savedData = await fs.promises.readFile('saved_vulnerabilities.json', 'utf8');
        const savedVulnerabilities = JSON.parse(savedData);
        const saveButton = document.getElementById('save');
        
        // Check if ID already exists
        if (!savedVulnerabilities.saved_ids.includes(currentFileData.id)) {
            // Add new ID
            savedVulnerabilities.saved_ids.push(currentFileData.id);
            
            // Write back to file using fs.promises
            await fs.promises.writeFile('saved_vulnerabilities.json', JSON.stringify(savedVulnerabilities, null, 2));
            
            // Update button text and show success message
            saveButton.textContent = 'Remove';
            showMessage('Vulnerability saved successfully!');
        } else {
            // Remove the ID
            savedVulnerabilities.saved_ids = savedVulnerabilities.saved_ids.filter(id => id !== currentFileData.id);
            
            // Write back to file using fs.promises
            await fs.promises.writeFile('saved_vulnerabilities.json', JSON.stringify(savedVulnerabilities, null, 2));
            
            // Update button text and show success message
            saveButton.textContent = 'Save this';
            showMessage('Vulnerability removed successfully!');

            // If we're in saved problems mode, handle the removal
            if (showSavedOnly) {
                try {
                    // Get the updated list of saved vulnerabilities
                    const updatedSavedData = await fs.promises.readFile('saved_vulnerabilities.json', 'utf8');
                    const updatedSavedVulnerabilities = JSON.parse(updatedSavedData);
                    
                    // Filter the vulnerabilities based on saved IDs and current difficulty
                    let availableVulnerabilities = [...allVulnerabilities];
                    if (selectedDifficulty !== null) {
                        availableVulnerabilities = availableVulnerabilities.filter(v => v.difficulty === selectedDifficulty);
                    }
                    savedVulnerabilitiesList = availableVulnerabilities.filter(v => 
                        updatedSavedVulnerabilities.saved_ids.includes(v.id)
                    );

                    // If there are still saved problems, show the next one
                    if (savedVulnerabilitiesList.length > 0) {
                        const nextVulnerability = savedVulnerabilitiesList.shift();
                        currentFileData = nextVulnerability;
                        currentCode = nextVulnerability;
                        displayCode(nextVulnerability.code, nextVulnerability.filename);
                        currentVulnerabilities = [];
                        updateInstructions();
                        await updateSaveButtonText();
                    } else {
                        // If no saved problems left, exit saved problems mode
                        showSavedOnly = false;
                        showMessage('No more saved problems. Showing all problems.');
                        updateSavedProblemsIcon();
                        await loadAndDisplayVulnerability();
                    }
                } catch (error) {
                    console.error('Error handling saved problems after removal:', error);
                    showSavedOnly = false;
                    showMessage('Error loading next saved problem. Showing all problems.');
                    updateSavedProblemsIcon();
                    await loadAndDisplayVulnerability();
                }
            }
        }
    } catch (error) {
        console.error('Error saving/removing vulnerability:', error);
        showMessage('Error saving/removing vulnerability. Please try again.');
    }
}

// Add this function to update the save button text based on current state
async function updateSaveButtonText() {
    if (!currentFileData) return;

    try {
        const savedData = await fs.promises.readFile('saved_vulnerabilities.json', 'utf8');
        const savedVulnerabilities = JSON.parse(savedData);
        const saveButton = document.getElementById('save');
        
        if (savedVulnerabilities.saved_ids.includes(currentFileData.id)) {
            saveButton.textContent = 'Remove';
        } else {
            saveButton.textContent = 'Save this';
        }
    } catch (error) {
        console.error('Error updating save button:', error);
    }
}

// Update the function to update the saved problems icon color
function updateSavedProblemsIcon() {
    const savedProblemsIcon = document.querySelector('.menu-item:first-child .fas.fa-save');
    if (savedProblemsIcon) {
        if (showSavedOnly) {
            savedProblemsIcon.style.color = '#ff69b4'; // Pink color
            savedProblemsIcon.style.textShadow = '0 0 10px #ff69b4';
            savedProblemsIcon.style.animation = 'glow 1.5s ease-in-out infinite alternate';
            savedProblemsIcon.setAttribute('data-active', 'true');
        } else {
            savedProblemsIcon.style.color = '#e0e0e0'; // Default color
            savedProblemsIcon.style.textShadow = '';
            savedProblemsIcon.style.animation = '';
            savedProblemsIcon.setAttribute('data-active', 'false');
        }
    }
}

// Update the DOMContentLoaded event listener
document.addEventListener('DOMContentLoaded', async () => {
    try {
        // ... existing initialization code ...

        // Add the glow animation style
        const style = document.createElement('style');
        style.textContent = `
            @keyframes glow {
                from {
                    text-shadow: 0 0 5px #ff69b4;
                }
                to {
                    text-shadow: 0 0 10px #ff69b4, 0 0 20px #ff69b4;
                }
            }
            .menu-item:first-child .fas.fa-save,
            .difficulty-item .fas.fa-chart-line {
                transition: all 0.3s ease-in-out;
            }
        `;
        document.head.appendChild(style);

        // Initial update of icons
        updateSavedProblemsIcon();
        updateDifficultyIcon();
    } catch (error) {
        console.error('Error during initialization:', error);
        showMessage('Error initializing the application. Please try again.');
    }
});

// Initialize everything after DOM is loaded
document.addEventListener('DOMContentLoaded', async () => {
    try {
        // Load all vulnerabilities
        loadAllVulnerabilities();
        
        // Load initial vulnerability
        if (allVulnerabilities.length > 0) {
            await loadAndDisplayVulnerability();
        } else {
            showMessage('No vulnerabilities available to load.');
        }

        // Set up event listeners
        document.getElementById('hint').addEventListener('click', () => {
            if (currentFileData && currentFileData.hint) {
                showHint(currentFileData.hint);
            } else {
                showError('No hint available');
            }
        });

        // Add Show Answer button
        const showAnswerButton = document.createElement('button');
        showAnswerButton.id = 'show-answer';
        showAnswerButton.className = 'action-button';
        showAnswerButton.textContent = 'Show Answer';
        document.getElementById('hint').parentNode.insertBefore(showAnswerButton, document.getElementById('next'));

        showAnswerButton.addEventListener('click', () => {
            if (currentFileData && currentFileData.answer) {
                const answerSection = document.createElement('div');
                answerSection.className = 'answer-section';
                answerSection.innerHTML = `
                    <h3>Answer:</h3>
                    <p style="white-space: pre-line">${currentFileData.answer.replace(/\\n/g, '\n')}</p>
                `;
                
                // Remove any existing answer section
                const existingAnswer = document.getElementById('instructions-content').querySelector('.answer-section');
                if (existingAnswer) {
                    existingAnswer.remove();
                }
                
                document.getElementById('instructions-content').appendChild(answerSection);

                // Display the fixed code if available
                if (currentFileData.fixed_code) {
                    displayCode(currentFileData.code, currentFileData.filename + ' (Fixed)', currentFileData.fixed_code);
                }
            } else {
                showError('No answer available for this problem');
            }
        });

        // Add Save button
        const saveButton = document.createElement('button');
        saveButton.id = 'save';
        saveButton.className = 'action-button';
        saveButton.textContent = 'Save this';
        document.getElementById('hint').parentNode.insertBefore(saveButton, document.getElementById('next'));

        saveButton.addEventListener('click', saveCurrentVulnerability);

        // Add event listener for saved problems menu item
        const savedProblemsMenuItem = document.querySelector('.menu-item:first-child');
        if (savedProblemsMenuItem) {
            savedProblemsMenuItem.addEventListener('click', async () => {
                try {
                    const savedData = await fs.promises.readFile('saved_vulnerabilities.json', 'utf8');
                    const savedVulnerabilities = JSON.parse(savedData);
                    const savedCount = savedVulnerabilities.saved_ids.length;
                    
                    showSavedOnly = !showSavedOnly;
                    if (showSavedOnly) {
                        savedVulnerabilitiesList = [];
                        showMessage(`Showing ${savedCount} saved problem${savedCount !== 1 ? 's' : ''}`);
                        updateSavedProblemsIcon();
                    } else {
                        showMessage('Showing all problems');
                        showSavedOnly = false;
                        updateSavedProblemsIcon();
                    }
                    
                    // Update the icon color
                    updateSavedProblemsIcon();
                    
                    filteredVulnerabilities = [...allVulnerabilities];
                    await loadAndDisplayVulnerability();
        } catch (error) {
                    console.error('Error reading saved vulnerabilities:', error);
                    showMessage('Error loading saved problems. Showing all problems.');
                    showSavedOnly = false;
                    updateSavedProblemsIcon();
                }
            });
        }

        // Add event listener for next button
        const nextButton = document.getElementById('next');
        if (nextButton) {
            nextButton.addEventListener('click', async () => {
                if (showSavedOnly) {
                    // If showing saved problems, get the next one from the list
                    try {
                        const savedData = await fs.promises.readFile('saved_vulnerabilities.json', 'utf8');
                        const savedVulnerabilities = JSON.parse(savedData);
                        
                        // If we've gone through all saved problems, reset the list
                        if (savedVulnerabilitiesList.length === 0) {
                            savedVulnerabilitiesList = allVulnerabilities.filter(v => 
                                savedVulnerabilities.saved_ids.includes(v.id)
                            );
                            if (selectedDifficulty !== null) {
                                savedVulnerabilitiesList = savedVulnerabilitiesList.filter(v => 
                                    v.difficulty === selectedDifficulty
                                );
                            }
                        }
                        
                        // Get the next vulnerability from the saved list
                        const nextVulnerability = savedVulnerabilitiesList.shift();
                        if (nextVulnerability) {
                            currentFileData = nextVulnerability;
                            currentCode = nextVulnerability;
                            displayCode(nextVulnerability.code, nextVulnerability.filename);
                            currentVulnerabilities = [];
                            updateInstructions();
                            await updateSaveButtonText();
                            return;
                        }
                    } catch (error) {
                        console.error('Error reading saved vulnerabilities:', error);
                        showMessage('Error loading next saved problem. Showing all problems.');
                        showSavedOnly = false;
                        updateSavedProblemsIcon();
                    }
                }
                
                // If not showing saved problems or if there was an error, load a random vulnerability
                await loadAndDisplayVulnerability();
            });
        }

        // Initial update of save button text
        await updateSaveButtonText();

        // Add to the DOMContentLoaded event listener, before the event listeners
        const style = document.createElement('style');
        style.textContent = `
            @keyframes glow {
                from {
                    text-shadow: 0 0 5px #f1c40f;
                }
                to {
                    text-shadow: 0 0 10px #f1c40f, 0 0 20px #f1c40f;
                }
            }
            .menu-icon {
                transition: all 0.3s ease-in-out;
            }
            .difficulty-message {
                animation: slideIn 0.3s ease-out;
            }
            @keyframes slideIn {
                from {
                    opacity: 0;
                    transform: translateX(-50%) translateY(-20px);
                }
                to {
                    opacity: 1;
                    transform: translateX(-50%) translateY(0);
                }
            }
        `;
        document.head.appendChild(style);
    } catch (error) {
        console.error('Error during initialization:', error);
        showMessage('Error initializing the application. Please try again.');
    }
}); 