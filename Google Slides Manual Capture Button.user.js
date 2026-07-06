// ==UserScript==
// @name         Google Slides Auto-Capture & Next
// @namespace    https://example.local/
// @version      1.5
// @description  Automatically capture slides, move to the next slide, and download as ZIP when finished
// @match        https://docs.google.com/presentation/d/*/present*
// @grant        none
// @require      https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js
// ==/UserScript==

(async function () {
    'use strict';

    const zip = new JSZip();
    let slideIndex = 1;
    let capturedCount = 0;
    let isAutoRunning = false;

    function log(...a) { console.log('[auto-capture]', ...a); }

    async function showNotification(message) {
        const notif = document.createElement('div');
        notif.textContent = message;
        notif.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            padding: 10px 15px;
            background: rgba(0, 0, 0, 0.85);
            color: white;
            border-radius: 5px;
            z-index: 100000;
            opacity: 0;
            transition: opacity 0.5s ease-in-out;
            pointer-events: none;
            font-family: sans-serif;
        `;

        document.body.appendChild(notif);

        await new Promise(res => setTimeout(res, 10));
        notif.style.opacity = '1';

        await new Promise(res => setTimeout(res, 1000)); // slightly shortened for faster auto-runs
        notif.style.opacity = '0';

        await new Promise(res => setTimeout(res, 500));
        notif.remove();
    }

    async function inlineImagesInSVG(svg) {
        const images = Array.from(svg.querySelectorAll('image'));
        for (const imgEl of images) {
            try {
                const hrefAttr = imgEl.getAttribute('href') || imgEl.getAttribute('xlink:href');
                if (!hrefAttr || hrefAttr.startsWith('data:')) continue;
                const resp = await fetch(hrefAttr);
                if (!resp.ok) continue;
                const blob = await resp.blob();
                const base64 = await new Promise((res, rej) => {
                    const fr = new FileReader();
                    fr.onload = () => res(fr.result.split(',')[1]);
                    fr.onerror = rej;
                    fr.readAsDataURL(blob);
                });
                imgEl.setAttribute('href', `data:${blob.type};base64,${base64}`);
                if (imgEl.hasAttribute('xlink:href')) imgEl.removeAttribute('xlink:href');
            } catch (e) {
                log('inline error', e);
            }
        }
    }

    async function svgToPngBlob(svg) {
        const cloned = svg.cloneNode(true);
        if (!cloned.getAttribute('xmlns')) cloned.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
        if (!cloned.getAttribute('xmlns:xlink')) cloned.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');
        await inlineImagesInSVG(cloned);
        const svgString = new XMLSerializer().serializeToString(cloned);
        const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
        const url = URL.createObjectURL(svgBlob);

        const img = await new Promise((res, rej) => {
            const i = new Image();
            i.onload = () => res(i);
            i.onerror = rej;
            i.src = url;
        });

        const canvas = document.createElement('canvas');
        const desiredWidth = 1920;
        const desiredHeight = 1080;
        canvas.width = desiredWidth;
        canvas.height = desiredHeight;

        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, desiredWidth, desiredHeight);
        const pngBlob = await new Promise(res => canvas.toBlob(res, 'image/png'));
        URL.revokeObjectURL(url);
        return pngBlob;
    }

    async function captureCurrentSlide() {
        const svg = document.querySelector('.punch-viewer-svgpage-svgcontainer svg');
        if (!svg) {
            return false;
        }
        const blob = await svgToPngBlob(svg);
        const name = `Slide_${String(slideIndex).padStart(2, '0')}.png`;
        zip.file(name, blob);

        showNotification(`✅ Captured: ${name}`);
        log('captured', name);
        
        slideIndex++;
        capturedCount++;
        return svg.innerHTML; // Return content hash to check if the slide actually changed
    }

    function goToNextSlide() {
        // Simulates pressing the Right Arrow Key to go to the next slide
        const event = new KeyboardEvent('keydown', {
            key: 'ArrowRight',
            keyCode: 39,
            code: 'ArrowRight',
            which: 39,
            bubbles: true,
            cancelable: true
        });
        document.dispatchEvent(event);
    }

    async function downloadZip() {
        if (capturedCount === 0) {
            alert('No slides captured');
            return;
        }
        const content = await zip.generateAsync({ type: 'blob' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(content);
        a.download = 'Slides_Captured.zip';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    }

    async function startAutoCapture() {
        if (isAutoRunning) return;
        isAutoRunning = true;
        log('Starting auto-capture sequence...');

        while (isAutoRunning) {
            // 1. Capture the current slide and save its visual footprint
            const currentContent = await captureCurrentSlide();
            
            if (!currentContent) {
                alert('No slide found. Stopping loop.');
                isAutoRunning = false;
                break;
            }

            // 2. Advance to the next slide
            goToNextSlide();

            // 3. Wait for Google Slides transitions to settle
            await new Promise(res => setTimeout(res, 1200)); 

            // 4. Verification check: Did the slide actually change?
            const nextSvg = document.querySelector('.punch-viewer-svgpage-svgcontainer svg');
            if (!nextSvg || nextSvg.innerHTML === currentContent) {
                log('Detected end of presentation (slide did not change).');
                isAutoRunning = false;
                await showNotification('🎉 Finished! Preparing download...');
                await downloadZip();
            }
        }
    }

    function createUI() {
        const panel = document.createElement('div');
        panel.style.cssText = `
            position: fixed;
            top: 10px;
            right: 10px;
            z-index: 99999;
            background: #fff;
            padding: 10px;
            border: 1px solid #ccc;
            border-radius: 6px;
            font-size: 13px;
            font-family: sans-serif;
            box-shadow: 0 2px 10px rgba(0,0,0,0.2);
            display: flex;
            flex-direction: column;
            gap: 6px;
        `;

        const autoBtn = document.createElement('button');
        autoBtn.textContent = '▶️ Auto-Capture All';
        autoBtn.style.cursor = 'pointer';
        autoBtn.onclick = startAutoCapture;

        const capBtn = document.createElement('button');
        capBtn.textContent = '📸 Capture Single Slide';
        capBtn.style.cursor = 'pointer';
        capBtn.onclick = captureCurrentSlide;

        const stopBtn = document.createElement('button');
        stopBtn.textContent = '⬇️ Stop & Download';
        stopBtn.style.cursor = 'pointer';
        stopBtn.onclick = async () => {
            isAutoRunning = false;
            await downloadZip();
        };

        panel.appendChild(autoBtn);
        panel.appendChild(capBtn);
        panel.appendChild(stopBtn);
        document.body.appendChild(panel);
    }

    createUI();
    log('Automation framework loaded. Navigate to slide 1 and hit "Auto-Capture All".');
})();
