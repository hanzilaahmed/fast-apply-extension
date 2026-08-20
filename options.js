document.addEventListener('DOMContentLoaded', () => {
    const userEmailDisplay = document.getElementById('user-email-display');
    const authBtn = document.getElementById('auth-btn');
    const cvInput = document.getElementById('cv-upload');
    const fileNameDisplay = document.getElementById('file-name-display');
    const rewardUrlInput = document.getElementById('reward-url');
    const saveAllBtn = document.getElementById('save-all-btn');
    const statusMsg = document.getElementById('status');

    // Patterns DOM
    const addPatternBtn = document.getElementById('add-pattern-btn');
    const patternsList = document.getElementById('patterns-list');
    const patternEditor = document.getElementById('pattern-editor');
    const editorTitle = document.getElementById('editor-title');
    const patternNameInput = document.getElementById('pattern-name');
    const patternSubjectInput = document.getElementById('pattern-subject');
    const patternBodyInput = document.getElementById('pattern-body');
    const patternCvUpload = document.getElementById('pattern-cv-upload');
    const patternCvNameDisplay = document.getElementById('pattern-cv-name-display');
    const savePatternBtn = document.getElementById('save-pattern-btn');
    const cancelPatternBtn = document.getElementById('cancel-pattern-btn');

    let base64CV = null;
    let cvMimeType = null;
    let cvName = null;

    let tempPatternCvBase64 = null;
    let tempPatternCvMimeType = null;
    let tempPatternCvName = null;

    let patterns = [];
    let editingPatternId = null;

    // Check saved user email
    chrome.storage.local.get(['userEmail'], (res) => {
        if (res.userEmail) {
            userEmailDisplay.textContent = res.userEmail;
            authBtn.textContent = 'Connected ✓';
            authBtn.style.background = '#d1fae5';
            authBtn.style.color = '#059669';
            authBtn.style.borderColor = '#a7f3d0';
        } else {
            userEmailDisplay.textContent = 'Not Connected';
        }
    });

    authBtn.addEventListener('click', () => {
        const input = prompt('Enter your Gmail address:', userEmailDisplay.textContent.includes('@') ? userEmailDisplay.textContent : 'yourname@gmail.com');
        if (input && input.includes('@')) {
            chrome.storage.local.set({ userEmail: input.trim() }, () => {
                userEmailDisplay.textContent = input.trim();
                authBtn.textContent = 'Connected ✓';
                authBtn.style.background = '#d1fae5';
                authBtn.style.color = '#059669';
                authBtn.style.borderColor = '#a7f3d0';
                showStatus('Gmail address saved!', 'success');
            });
        }
    });

    // Load saved settings & patterns
    chrome.storage.local.get(['patterns', 'subject', 'body', 'cvName', 'cvBase64', 'cvMimeType', 'rewardWebUrl'], (res) => {
        if (res.rewardWebUrl) rewardUrlInput.value = res.rewardWebUrl;
        
        if (res.cvName) {
            fileNameDisplay.textContent = `Default CV: ${res.cvName}`;
            base64CV = res.cvBase64;
            cvMimeType = res.cvMimeType;
            cvName = res.cvName;
        }

        // Initialize patterns array
        if (res.patterns && Array.isArray(res.patterns) && res.patterns.length > 0) {
            patterns = res.patterns;
        } else {
            // Default initial patterns
            patterns = [
                {
                    id: 'pat_' + Date.now(),
                    name: 'Full Stack Developer',
                    subject: res.subject || 'Application for Full Stack Developer Position - [Your Name]',
                    body: res.body || 'Dear Hiring Manager,\n\nI am writing to apply for the open position at your company. Please find my attached resume outlining my experience.\n\nBest regards,\n[Your Name]',
                    isDefault: true
                },
                {
                    id: 'pat_' + (Date.now() + 1),
                    name: 'Frontend Engineer',
                    subject: 'Application for Frontend Engineer Role - [Your Name]',
                    body: 'Dear HR Team,\n\nI am excited to submit my resume for the Frontend Engineer role. With extensive web development experience, I am confident in adding value to your team.\n\nBest regards,\n[Your Name]',
                    isDefault: false
                }
            ];
            chrome.storage.local.set({ patterns: patterns });
        }

        renderPatterns();
    });

    // Handle Global Default CV file selection
    if (cvInput) {
        cvInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;

            fileNameDisplay.textContent = `Selected Default CV: ${file.name}`;
            
            const reader = new FileReader();
            reader.onload = function(evt) {
                const result = evt.target.result;
                const matches = result.match(/^data:(.*);base64,(.*)$/);
                if (matches && matches.length === 3) {
                    cvMimeType = matches[1];
                    base64CV = matches[2];
                    cvName = file.name;
                }
            };
            reader.readAsDataURL(file);
        });
    }

    // Handle Pattern-Specific CV file selection
    if (patternCvUpload) {
        patternCvUpload.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;

            patternCvNameDisplay.textContent = `Pattern CV Attached: ${file.name}`;
            
            const reader = new FileReader();
            reader.onload = function(evt) {
                const result = evt.target.result;
                const matches = result.match(/^data:(.*);base64,(.*)$/);
                if (matches && matches.length === 3) {
                    tempPatternCvMimeType = matches[1];
                    tempPatternCvBase64 = matches[2];
                    tempPatternCvName = file.name;
                }
            };
            reader.readAsDataURL(file);
        });
    }

    // Render Pattern Cards
    function renderPatterns() {
        patternsList.innerHTML = '';
        patterns.forEach(pat => {
            const card = document.createElement('div');
            card.className = `pattern-card ${pat.isDefault ? 'default-pattern' : ''}`;
            
            const cvLabel = pat.cvName ? `📄 Attached CV: ${pat.cvName}` : `📄 Uses Default CV`;

            card.innerHTML = `
                <div class="pattern-card-header">
                    <div class="pattern-name">
                        <span>${pat.name}</span>
                        ${pat.isDefault ? '<span class="default-badge">DEFAULT</span>' : ''}
                    </div>
                    <div class="pattern-actions">
                        ${!pat.isDefault ? `<button class="action-btn-sm set-default-btn" data-id="${pat.id}">Make Default</button>` : ''}
                        <button class="action-btn-sm edit-btn" data-id="${pat.id}">Edit</button>
                        ${patterns.length > 1 ? `<button class="action-btn-sm delete delete-btn" data-id="${pat.id}">Delete</button>` : ''}
                    </div>
                </div>
                <div class="pattern-subject-preview"><strong>Subject:</strong> ${pat.subject}</div>
                <div class="pattern-cv-preview">${cvLabel}</div>
                <div class="pattern-body-preview">${pat.body.replace(/\n/g, ' ')}</div>
            `;
            patternsList.appendChild(card);
        });

        // Add event listeners to dynamic buttons
        document.querySelectorAll('.set-default-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = e.target.dataset.id;
                patterns.forEach(p => p.isDefault = (p.id === id));
                savePatternsToStorage('Default pattern updated!');
            });
        });

        document.querySelectorAll('.edit-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = e.target.dataset.id;
                openEditor(id);
            });
        });

        document.querySelectorAll('.delete-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = e.target.dataset.id;
                if (patterns.length <= 1) return;
                patterns = patterns.filter(p => p.id !== id);
                if (!patterns.some(p => p.isDefault)) {
                    patterns[0].isDefault = true;
                }
                savePatternsToStorage('Pattern deleted!');
            });
        });
    }

    addPatternBtn.addEventListener('click', () => {
        openEditor(null);
    });

    function openEditor(patternId) {
        editingPatternId = patternId;
        tempPatternCvBase64 = null;
        tempPatternCvMimeType = null;
        tempPatternCvName = null;

        if (patternCvUpload) patternCvUpload.value = '';

        if (patternId) {
            const p = patterns.find(item => item.id === patternId);
            if (p) {
                editorTitle.textContent = 'Edit Email Pattern';
                patternNameInput.value = p.name;
                patternSubjectInput.value = p.subject;
                patternBodyInput.value = p.body;
                
                if (p.cvName) {
                    tempPatternCvName = p.cvName;
                    tempPatternCvBase64 = p.cvBase64;
                    tempPatternCvMimeType = p.cvMimeType;
                    patternCvNameDisplay.textContent = `Current Pattern CV: ${p.cvName}`;
                } else {
                    patternCvNameDisplay.textContent = 'Optional: Attach a specific CV for this role (uses Default CV if empty).';
                }
            }
        } else {
            editorTitle.textContent = 'Add New Email Pattern';
            patternNameInput.value = '';
            patternSubjectInput.value = '';
            patternBodyInput.value = '';
            patternCvNameDisplay.textContent = 'Optional: Attach a specific CV for this role (uses Default CV if empty).';
        }
        patternEditor.style.display = 'block';
        patternEditor.scrollIntoView({ behavior: 'smooth' });
    }

    cancelPatternBtn.addEventListener('click', () => {
        patternEditor.style.display = 'none';
        editingPatternId = null;
    });

    savePatternBtn.addEventListener('click', () => {
        const name = patternNameInput.value.trim();
        const subject = patternSubjectInput.value.trim();
        const body = patternBodyInput.value.trim();

        if (!name || !subject || !body) {
            showStatus('Please complete Pattern Name, Subject, and Body.', 'error');
            return;
        }

        if (editingPatternId) {
            const p = patterns.find(item => item.id === editingPatternId);
            if (p) {
                p.name = name;
                p.subject = subject;
                p.body = body;
                if (tempPatternCvName) {
                    p.cvName = tempPatternCvName;
                    p.cvBase64 = tempPatternCvBase64;
                    p.cvMimeType = tempPatternCvMimeType;
                }
            }
        } else {
            const isFirst = patterns.length === 0;
            patterns.push({
                id: 'pat_' + Date.now(),
                name: name,
                subject: subject,
                body: body,
                cvName: tempPatternCvName,
                cvBase64: tempPatternCvBase64,
                cvMimeType: tempPatternCvMimeType,
                isDefault: isFirst
            });
        }

        patternEditor.style.display = 'none';
        editingPatternId = null;
        savePatternsToStorage('Pattern saved successfully!');
    });

    function savePatternsToStorage(msg) {
        renderPatterns();
        const defaultPat = patterns.find(p => p.isDefault) || patterns[0];
        chrome.storage.local.set({
            patterns: patterns,
            subject: defaultPat ? defaultPat.subject : '',
            body: defaultPat ? defaultPat.body : ''
        }, () => {
            if (msg) showStatus(msg, 'success');
        });
    }

    // Save All Configuration Button
    saveAllBtn.addEventListener('click', () => {
        const rewardUrl = rewardUrlInput.value.trim();
        saveAllBtn.textContent = 'Saving...';
        saveAllBtn.disabled = true;

        const defaultPat = patterns.find(p => p.isDefault) || patterns[0];

        chrome.storage.local.set({
            patterns: patterns,
            subject: defaultPat ? defaultPat.subject : '',
            body: defaultPat ? defaultPat.body : '',
            cvBase64: base64CV,
            cvMimeType: cvMimeType,
            cvName: cvName,
            rewardWebUrl: rewardUrl || 'https://fast-apply-extension.vercel.app'
        }, () => {
            saveAllBtn.textContent = 'Save All Settings';
            saveAllBtn.disabled = false;
            showStatus('All settings saved successfully!', 'success');
        });
    });

    function showStatus(text, type) {
        statusMsg.textContent = text;
        statusMsg.className = 'status-msg ' + type;
        setTimeout(() => { statusMsg.textContent = ''; }, 3000);
    }
});
