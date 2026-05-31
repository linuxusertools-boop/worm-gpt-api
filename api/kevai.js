const puppeteer = require('puppeteer-core');

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
    res.setHeader('Content-Type', 'application/json');

    if (req.method === 'OPTIONS') return res.status(200).end();

    const query = req.query.text;
    if (!query) return res.status(400).json({ status: false, message: "Query 'text' kosong!" });

    let browser;
    try {
        const token = "2UcGtiiW53vvTQsb34883036c91d61a377ddb72471132d695";
        browser = await puppeteer.connect({
            browserWSEndpoint: `wss://chrome.browserless.io?token=${token}`,
        });

        const page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');

        // Buka halaman
        await page.goto('https://perchance.org/e5nrresv8a', { 
            waitUntil: 'networkidle2', 
            timeout: 30000 
        });

        // FUNGSI PINTAR: Mencari elemen di halaman utama atau di dalam SEMUA frame yang ada
        const findInFrames = async (selector) => {
            const allFrames = page.frames();
            for (const frame of allFrames) {
                try {
                    const found = await frame.$(selector);
                    if (found) return frame;
                } catch (e) { continue; }
            }
            return null;
        };

        // Tunggu maksimal 10 detik untuk mencari frame yang berisi select/textarea
        let worker = null;
        for (let i = 0; i < 20; i++) {
            worker = await findInFrames('textarea');
            if (worker) break;
            await new Promise(r => setTimeout(r, 500));
        }

        if (!worker) throw new Error("Gagal menemukan area chat (Iframe tidak termuat).");

        // 1. Pilih Model Gemini Flash (Gunakan evaluate agar lebih cepat & anti-fail)
        await worker.evaluate(() => {
            const sel = document.querySelector('select');
            if (sel) {
                const opt = Array.from(sel.options).findIndex(o => o.text.toLowerCase().includes('flash'));
                if (opt !== -1) {
                    sel.selectedIndex = opt;
                    sel.dispatchEvent(new Event('change', { bubbles: true }));
                }
            }
        });

        // 2. Ketik & Kirim
        await worker.focus('textarea');
        await worker.type('textarea', query);
        
        await worker.evaluate(() => {
            const btn = document.querySelector('button[title*="send" i]') || 
                        document.querySelector('textarea ~ button') || 
                        document.querySelector('.input-area button') ||
                        document.querySelector('button svg')?.parentElement; // Cari tombol dengan icon
            if (btn) btn.click();
        });

        // 3. Ambil Jawaban (Looping deteksi teks baru)
        let result = "";
        for (let i = 0; i < 15; i++) {
            await new Promise(r => setTimeout(r, 700));
            result = await worker.evaluate((userInput) => {
                const elements = Array.from(document.querySelectorAll('div, span, p'))
                    .filter(el => {
                        const txt = el.innerText.trim().toLowerCase();
                        const isUI = ['close', 'clear', 'memory', 'gemini flash', 'type a message', 'guest', 'new chat'].some(w => txt === w);
                        return el.innerText.length > 1 && !isUI && txt !== userInput.toLowerCase() && el.tagName !== 'BUTTON';
                    });
                
                if (elements.length > 0) {
                    const lastText = elements[elements.length - 1].innerText.trim();
                    if (lastText.includes('⏳') || lastText.toLowerCase().includes('loading')) return "WAIT";
                    return lastText;
                }
                return "WAIT";
            }, query);
            
            if (result !== "WAIT") break;
        }

        await browser.close();

        return res.status(200).json({
            status: true,
            creator: "KevCodex",
            result: result === "WAIT" ? "AI terlalu lama merespon." : result
        });

    } catch (e) {
        if (browser) await browser.close();
        return res.status(500).json({ status: false, error: "System Error: " + e.message });
    }
};
            const sel = document.querySelector('select');
            if (sel) {
                const opt = Array.from(sel.options).findIndex(o => o.text.toLowerCase().includes('flash'));
                if (opt !== -1) {
                    sel.selectedIndex = opt;
                    sel.dispatchEvent(new Event('change', { bubbles: true }));
                }
            }
        });

        // 2. Ketik & Kirim
        await worker.waitForSelector('textarea', { timeout: 5000 });
        await worker.type('textarea', query);
        await worker.evaluate(() => {
            const btn = document.querySelector('button[title*="send" i]') || 
                        document.querySelector('textarea ~ button') || 
                        document.querySelector('.input-area button');
            if (btn) btn.click();
        });

        // 3. Ambil Jawaban (Looping 5 detik)
        let result = "";
        for (let i = 0; i < 10; i++) {
            await new Promise(r => setTimeout(r, 600));
            result = await worker.evaluate((userInput) => {
                const elements = Array.from(document.querySelectorAll('div, span, p'))
                    .filter(el => {
                        const txt = el.innerText.trim().toLowerCase();
                        const isUI = ['close', 'clear', 'memory', 'gemini flash', 'type a message', 'guest'].some(w => txt === w);
                        return el.innerText.length > 1 && !isUI && txt !== userInput.toLowerCase() && el.tagName !== 'BUTTON';
                    });
                if (elements.length > 0) {
                    const lastText = elements[elements.length - 1].innerText.trim();
                    if (lastText.includes('⏳') || lastText.toLowerCase().includes('loading')) return "WAIT";
                    return lastText;
                }
                return "WAIT";
            }, query);
            if (result !== "WAIT") break;
        }

        await browser.close();

        return res.status(200).json({
            status: true,
            creator: "flowskev",
            result: result === "WAIT" ? "Gagal mengambil respon (Timeout)" : result
        });

    } catch (e) {
        if (browser) await browser.close();
        return res.status(500).json({ status: false, error: e.message });
    }
};
