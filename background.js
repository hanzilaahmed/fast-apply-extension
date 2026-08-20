function getBase64EncodedEmail(to, subject, body, cvName, cvMimeType, cvBase64) {
    // Generate a unique boundary for MIME multi-part message
    const boundary = "boundary_fast_apply_" + Date.now().toString(16);
    
    // Use UTF-8 base64 encoding for subject to allow special chars
    const base64Subject = btoa(unescape(encodeURIComponent(subject)));
    
    let message = `To: ${to}\r\n`;
    message += `Subject: =?utf-8?B?${base64Subject}?=\r\n`;
    message += `MIME-Version: 1.0\r\n`;
    message += `Content-Type: multipart/mixed; boundary="${boundary}"\r\n\r\n`;

    // 1. Text part
    message += `--${boundary}\r\n`;
    message += `Content-Type: text/plain; charset="UTF-8"\r\n`;
    message += `Content-Transfer-Encoding: 7bit\r\n\r\n`;
    message += `${body}\r\n\r\n`;

    // 2. Attachment part (if present)
    if (cvName && cvBase64 && cvMimeType) {
        message += `--${boundary}\r\n`;
        message += `Content-Type: ${cvMimeType}; name="${cvName}"\r\n`;
        message += `Content-Disposition: attachment; filename="${cvName}"\r\n`;
        message += `Content-Transfer-Encoding: base64\r\n\r\n`;
        
        // Chunk base64 into 76 chars per line for standard MIME format (RFC 2045)
        let b64Chunks = cvBase64.match(/.{1,76}/g) || [];
        message += b64Chunks.join("\r\n") + "\r\n\r\n";
    }

    message += `--${boundary}--\r\n`;
    
    // Base64url encode the entire MIME message string
    return btoa(unescape(encodeURIComponent(message)))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
}

// Helper: Check & perform daily reset (5 base credits, reset if new day, capped at 5)
function getVerifiedCredits(callback) {
    const todayStr = new Date().toDateString();
    chrome.storage.local.get(['credits', 'lastResetDate'], (res) => {
        let credits = res.credits;
        let lastResetDate = res.lastResetDate;

        if (lastResetDate !== todayStr) {
            // New day: reset back to baseline 5 (does not accumulate)
            credits = 5;
            lastResetDate = todayStr;
            chrome.storage.local.set({ credits: 5, lastResetDate: todayStr }, () => {
                callback(credits);
            });
        } else {
            if (typeof credits === 'undefined' || credits === null) {
                credits = 5;
                chrome.storage.local.set({ credits: 5, lastResetDate: todayStr }, () => {
                    callback(credits);
                });
            } else {
                callback(credits);
            }
        }
    });
}

// 1. Listen for internal messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'send_email') {
        getVerifiedCredits((currentCredits) => {
            if (currentCredits <= 0) {
                sendResponse({ success: false, error: 'Out of credits. Please watch a rewarded ad to get +5 applications.', outOfCredits: true });
                return;
            }

            // Get settings and selected pattern
            chrome.storage.local.get(['subject', 'body', 'cvName', 'cvBase64', 'cvMimeType'], (settings) => {
                const mailSubject = request.subject || settings.subject;
                const mailBody = request.body || settings.body;

                if (!mailSubject || !mailBody) {
                    sendResponse({ success: false, error: 'Template not configured. Please open Options.' });
                    return;
                }

                // Determine CV to attach (pattern-specific or global default)
                const sendCvName = request.cvName || settings.cvName;
                const sendCvBase64 = request.cvBase64 || settings.cvBase64;
                const sendCvMimeType = request.cvMimeType || settings.cvMimeType;

                // Check auth token
                chrome.identity.getAuthToken({ interactive: false }, (token) => {
                    if (chrome.runtime.lastError || !token) {
                        // Fallback: Open Gmail Web Compose with prefilled To, Subject, Body
                        const composeUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(request.hrEmail)}&su=${encodeURIComponent(mailSubject)}&body=${encodeURIComponent(mailBody)}`;
                        chrome.tabs.create({ url: composeUrl });

                        const remainingCredits = Math.max(0, currentCredits - 1);
                        chrome.storage.local.set({ credits: remainingCredits }, () => {
                            sendResponse({ success: true, remainingCredits: remainingCredits, openedGmailWeb: true });
                        });
                        return;
                    }

                    // Build MIME email string for Gmail API
                    const rawMessage = getBase64EncodedEmail(
                        request.hrEmail, 
                        mailSubject, 
                        mailBody, 
                        sendCvName, 
                        sendCvMimeType, 
                        sendCvBase64
                    );

                    // Send via Gmail API
                    fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
                        method: 'POST',
                        headers: {
                            'Authorization': 'Bearer ' + token,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            raw: rawMessage
                        })
                    })
                    .then(res => {
                        if (!res.ok) {
                            return res.json().then(errData => {
                                throw new Error(errData.error?.message || 'Failed to send API request.');
                            });
                        }
                        return res.json();
                    })
                    .then(data => {
                        const remainingCredits = Math.max(0, currentCredits - 1);
                        chrome.storage.local.set({ credits: remainingCredits }, () => {
                            sendResponse({ success: true, data: data, remainingCredits: remainingCredits });
                        });
                    })
                    .catch(err => {
                        console.error('Gmail API Error, fallback to Gmail Web Compose:', err);
                        const composeUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(request.hrEmail)}&su=${encodeURIComponent(mailSubject)}&body=${encodeURIComponent(mailBody)}`;
                        chrome.tabs.create({ url: composeUrl });

                        const remainingCredits = Math.max(0, currentCredits - 1);
                        chrome.storage.local.set({ credits: remainingCredits }, () => {
                            sendResponse({ success: true, remainingCredits: remainingCredits, openedGmailWeb: true });
                        });
                    });
                });
            });
        });
        return true; // Async response
    }

    if (request.action === 'get_credits') {
        getVerifiedCredits((credits) => {
            sendResponse({ credits: credits });
        });
        return true;
    }
});

// 2. Listen for external messages from Vercel Rewarded Ad Page
chrome.runtime.onMessageExternal.addListener((request, sender, sendResponse) => {
    if (request.action === 'ADD_REWARD_CREDITS') {
        getVerifiedCredits((currentCredits) => {
            const addedCredits = request.amount || 5;
            const newTotal = currentCredits + addedCredits;
            
            chrome.storage.local.set({ credits: newTotal }, () => {
                sendResponse({ success: true, newBalance: newTotal });
            });
        });
        return true;
    }
    
    if (request.action === 'PING_EXTENSION') {
        sendResponse({ success: true, version: '1.1.0' });
        return true;
    }
});
