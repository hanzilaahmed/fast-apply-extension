document.addEventListener('DOMContentLoaded', () => {
    const authSection = document.getElementById('auth-section');
    const mainSection = document.getElementById('main-section');
    const authBtn = document.getElementById('auth-btn');
    const userEmailText = document.getElementById('popup-user-email');
    const sendBtn = document.getElementById('send-btn');
    const hrEmailInput = document.getElementById('hr-email');
    const pasteBtn = document.getElementById('paste-btn');
    const patternSelect = document.getElementById('pattern-select');
    const previewSubjectText = document.getElementById('preview-subject-text');
    const statusMsg = document.getElementById('status-msg');
    const optionsLink = document.getElementById('options-link');
    const manualAdLink = document.getElementById('manual-ad-link');
    const btnText = document.getElementById('btn-text');
    const spinner = document.getElementById('spinner');
    const creditBadge = document.getElementById('credit-badge');
    const creditCount = document.getElementById('credit-count');
    const adRewardBox = document.getElementById('ad-reward-box');
    const watchAdBtn = document.getElementById('watch-ad-btn');
    const themeDots = document.querySelectorAll('.theme-dot');

    let currentCredits = 5;
    let loadedPatterns = [];
    let selectedPattern = null;

    // Theme Switcher Logic (Defaults to Clean White Light theme)
    chrome.storage.local.get(['selectedTheme'], (res) => {
        const activeTheme = res.selectedTheme || 'theme-light';
        applyTheme(activeTheme);
    });

    themeDots.forEach(dot => {
        dot.addEventListener('click', () => {
            const themeClass = dot.getAttribute('data-theme');
            applyTheme(themeClass);
            chrome.storage.local.set({ selectedTheme: themeClass });
        });
    });

    function applyTheme(themeClass) {
        document.body.className = '';
        if (themeClass) {
            document.body.classList.add(themeClass);
        }

        themeDots.forEach(d => {
            if (d.getAttribute('data-theme') === themeClass) {
                d.classList.add('active');
            } else {
                d.classList.remove('active');
            }
        });
    }

    // Paste from Clipboard feature
    pasteBtn.addEventListener('click', async () => {
        try {
            const text = await navigator.clipboard.readText();
            if (text && text.includes('@')) {
                hrEmailInput.value = text.trim();
                showStatus('Pasted email from clipboard!', 'success');
            } else if (text) {
                hrEmailInput.value = text.trim();
                showStatus('Pasted text from clipboard.', 'success');
            } else {
                showStatus('Clipboard is empty.', 'error');
            }
        } catch (err) {
            hrEmailInput.focus();
            document.execCommand('paste');
            showStatus('Focused HR Email input.', 'success');
        }
    });

    // Open Options page
    optionsLink.addEventListener('click', (e) => {
        e.preventDefault();
        chrome.runtime.openOptionsPage();
    });

    // Option 2: Open Dedicated Popup Window for Rewarded Ad
    function openRewardedAdPage() {
        chrome.storage.local.get(['rewardWebUrl'], (res) => {
            const defaultUrl = 'https://fast-apply-extension.vercel.app';
            const targetUrl = res.rewardWebUrl || defaultUrl;
            const extId = chrome.runtime.id || '';
            const finalUrl = targetUrl.includes('?') 
                ? `${targetUrl}&extId=${extId}` 
                : `${targetUrl}?extId=${extId}`;

            const width = 480;
            const height = 640;

            if (chrome.windows && chrome.windows.create) {
                chrome.windows.create({
                    url: finalUrl,
                    type: 'popup',
                    width: width,
                    height: height,
                    focused: true
                });
            } else {
                chrome.tabs.create({ url: finalUrl });
            }

            showStatus('Opening Rewarded Ad window (+5 Credits)...', 'success');
        });
    }

    watchAdBtn.addEventListener('click', openRewardedAdPage);
    manualAdLink.addEventListener('click', (e) => {
        e.preventDefault();
        openRewardedAdPage();
    });

    // Load patterns dropdown
    function loadPatterns() {
        chrome.storage.local.get(['patterns', 'subject', 'body'], (res) => {
            patternSelect.innerHTML = '';
            if (res.patterns && Array.isArray(res.patterns) && res.patterns.length > 0) {
                loadedPatterns = res.patterns;
            } else {
                loadedPatterns = [{
                    id: 'default',
                    name: 'Default Pattern',
                    subject: res.subject || 'Application for Position - [Your Name]',
                    body: res.body || 'Dear Hiring Manager,\n\nPlease accept my application.',
                    isDefault: true
                }];
            }

            loadedPatterns.forEach(pat => {
                const opt = document.createElement('option');
                opt.value = pat.id;
                opt.textContent = pat.name + (pat.isDefault ? ' (Default)' : '');
                if (pat.isDefault) opt.selected = true;
                patternSelect.appendChild(opt);
            });

            updateSelectedPattern();
        });
    }

    function updateSelectedPattern() {
        const selectedId = patternSelect.value;
        selectedPattern = loadedPatterns.find(p => p.id === selectedId) || loadedPatterns[0];
        if (selectedPattern) {
            previewSubjectText.textContent = selectedPattern.subject;
        }
    }

    patternSelect.addEventListener('change', updateSelectedPattern);

    // Refresh and sync credits
    function syncCredits() {
        chrome.runtime.sendMessage({ action: 'get_credits' }, (res) => {
            if (res && typeof res.credits !== 'undefined') {
                currentCredits = res.credits;
                updateCreditUI(currentCredits);
            }
        });
    }

    function updateCreditUI(credits) {
        creditCount.textContent = credits;
        creditBadge.className = 'credit-badge';

        if (credits <= 0) {
            creditBadge.classList.add('empty');
            sendBtn.style.display = 'none';
            adRewardBox.style.display = 'block';
        } else {
            sendBtn.style.display = 'flex';
            adRewardBox.style.display = 'none';
            if (credits <= 2) {
                creditBadge.classList.add('low');
            }
        }
    }

    // Check Google Authentication & fetch User Profile Email
    chrome.identity.getAuthToken({ interactive: false }, (token) => {
        if (chrome.runtime.lastError || !token) {
            authSection.style.display = 'block';
            mainSection.style.display = 'none';
        } else {
            authSection.style.display = 'none';
            mainSection.style.display = 'block';
            fetchUserProfileEmail(token);
            loadPatterns();
            syncCredits();
        }
    });

    function fetchUserProfileEmail(token) {
        fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
            headers: { Authorization: `Bearer ${token}` }
        })
        .then(res => res.json())
        .then(data => {
            if (data.email) {
                userEmailText.textContent = data.email;
            } else {
                userEmailText.textContent = 'Connected Account';
            }
        })
        .catch(() => {
            userEmailText.textContent = 'Connected Account';
        });
    }

    authBtn.addEventListener('click', () => {
        chrome.identity.getAuthToken({ interactive: true }, (token) => {
            if (chrome.runtime.lastError || !token) {
                showStatus('Authentication failed/cancelled.', 'error');
            } else {
                authSection.style.display = 'none';
                mainSection.style.display = 'block';
                fetchUserProfileEmail(token);
                loadPatterns();
                syncCredits();
                showStatus('Connected with Google!', 'success');
            }
        });
    });

    // Handle Send Application
    sendBtn.addEventListener('click', () => {
        if (currentCredits <= 0) {
            updateCreditUI(0);
            showStatus('You are out of credits for today. Please watch an ad.', 'error');
            return;
        }

        const hrEmail = hrEmailInput.value.trim();
        if (!hrEmail || !hrEmail.includes('@')) {
            showStatus('Please enter a valid HR email.', 'error');
            return;
        }

        if (!selectedPattern) {
            updateSelectedPattern();
        }

        sendBtn.disabled = true;
        btnText.textContent = 'Sending...';
        spinner.style.display = 'block';
        statusMsg.textContent = '';
        
        chrome.runtime.sendMessage({
            action: 'send_email',
            hrEmail: hrEmail,
            subject: selectedPattern ? selectedPattern.subject : null,
            body: selectedPattern ? selectedPattern.body : null
        }, (response) => {
            sendBtn.disabled = false;
            btnText.textContent = 'Send Application (1 Credit)';
            spinner.style.display = 'none';

            if (chrome.runtime.lastError) {
                showStatus('Internal Error: Could not connect to background.', 'error');
                return;
            }

            if (!response || !response.success) {
                if (response && response.outOfCredits) {
                    updateCreditUI(0);
                }
                showStatus((response && response.error) || 'Failed to send email.', 'error');
            } else {
                showStatus('✓ Application & CV Sent Successfully!', 'success');
                hrEmailInput.value = '';
                if (typeof response.remainingCredits !== 'undefined') {
                    currentCredits = response.remainingCredits;
                    updateCreditUI(currentCredits);
                } else {
                    syncCredits();
                }
            }
        });
    });

    function showStatus(text, type) {
        statusMsg.textContent = text;
        statusMsg.className = type;
        setTimeout(() => { if(statusMsg.className === type) statusMsg.textContent = ''; }, 4000);
    }
});
