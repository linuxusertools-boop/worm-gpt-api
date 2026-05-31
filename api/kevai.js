const puppeteer = require('puppeteer-core');

module.exports = async (req, res) => {
    // Header agar API bisa ditembak dari mana saja (CORS)
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
    res.setHeader('Content-Type', 'application/json');

    if (req.method === 'OPTIONS') return res.status(200).end();

    const query = req.query.text;
    if (!query) return res.status(400).json({ status: false, message: "Parameter ?text= diperlukan" });

    let browser;
    try {
        // Menghubungkan ke Browserless Cloud menggunakan token kamu
        const auth = "2UcGtiiW53vvTQsb34883036c91d61a377ddb72471132d695";
        browser = await puppeteer.connect({
            browserWSEndpoint: `wss://chrome.browserless.io?token=${auth}`
        });

        const page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');

        // Buka Perchance langsung ke target
        await page.goto('https://perchance.org/e5nrresv8a', { waitUntil: 'networkidle2', timeout: 30000 });

        // Cari frame generator
        const frames = page.frames();
        const worker = frames.find(f => f.url().includes('perchance.org')) || page;

        // 1. Pilih Model Gemini Flash (Sesuai UI yang kamu kirim)
        await worker.waitForSelector('select', { timeout: 5000 });
        await worker.evaluate(() => {
            const sel = document.querySelector('select');
            if (sel) {
                const optIndex = Array.from(sel.options).findIndex(o => o.text.toLowerCase().includes('flash'));
                if (optIndex !== -1) {
                    sel.selectedIndex = optIndex;
                    sel.dispatchEvent(new Event('change', { bubbles: true }));
                }
            }
        });

        // 2. Ketik & Kirim Cepat
        await worker.waitForSelector('textarea', { timeout: 5000 });
        await worker.type('textarea', query);
        
        await worker.evaluate(() => {
            const btn = document.querySelector('button[title*="send" i]') || 
                        document.querySelector('textarea ~ button') || 
                        document.querySelector('.input-area button');
            if (btn) btn.click();
        });

        // 3. Pooling Result (Deteksi Flash - Cek setiap 500ms)
        let result = "";
        let attempt = 0;
        const maxAttempts = 15; // Max 7.5 detik

        while (attempt < maxAttempts) {
            await new Promise(r => setTimeout(r, 500));
            
            result = await worker.evaluate((userInput) => {
                const elements = Array.from(document.querySelectorAll('div, span, p'))
                    .filter(el => {
                        const txt = el.innerText.trim().toLowerCase();
                        // Filter teks sampah UI
                        const isUI = ['close', 'clear', 'memory', 'gemini flash', 'type a message', 'guest'].some(w => txt === w);
                        return el.innerText.length > 1 && !isUI && txt !== userInput.toLowerCase() && el.tagName !== 'BUTTON';
                    });

                if (elements.length > 0) {
                    const lastText = elements[elements.length - 1].innerText.trim();
                    // Jika masih loading, return status WAITING
                    if (lastText.includes('⏳') || lastText.toLowerCase().includes('loading')) return "WAITING_AI";
                    return lastText;
                }
                return "WAITING_AI";
            }, query);

            if (result !== "WAITING_AI") break;
            attempt++;
        }

        await browser.close();

        return res.status(200).json({
            status: true,
            creator: "KevCodex",
            model: "Gemini Flash",
            result: result === "WAITING_AI" ? "AI sedang sibuk, coba lagi nanti." : result
        });

    } catch (e) {
        if (browser) await browser.close();
        return res.status(500).json({ status: false, error: e.message });
    }
};

        // Buka Perchance
        await page.goto('https://perchance.org/e5nrresv8a', { waitUntil: 'domcontentloaded' });

        const frames = page.frames();
        const worker = frames.find(f => f.url().includes('perchance.org/embed') || f.url().includes('perchance-templated-pages')) || page;

        // 1. Pastikan Gemini Flash Terpilih
        await worker.waitForSelector('select');
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

        // 2. Ketik Pesan & Kirim
        await worker.waitForSelector('textarea');
        await worker.type('textarea', query);
        await worker.evaluate(() => {
            const btn = document.querySelector('button[title*="send" i]') || document.querySelector('.input-area button') || document.querySelector('textarea ~ button');
            if (btn) btn.click();
        });

        // 3. Sistem Pooling Cepat (Max 6 detik agar tidak terkena limit timeout Vercel)
        let result = "";
        let retries = 0;
        const maxRetries = 12; // 12 * 500ms = 6 Detik

        while (retries < maxRetries) {
            await new Promise(r => setTimeout(r, 500));
            
            result = await worker.evaluate((userInput) => {
                const elements = Array.from(document.querySelectorAll('div, span, p'))
                    .filter(el => {
                        const txt = el.innerText.trim().toLowerCase();
                        const isUI = ['close', 'clear', 'memory', 'gemini flash', 'guest', 'type a message'].some(word => txt === word);
                        return el.innerText.length > 1 && !isUI && txt !== userInput.toLowerCase() && el.tagName !== 'BUTTON';
                    });

                if (elements.length > 0) {
                    const lastText = elements[elements.length - 1].innerText.trim();
                    if (lastText.includes('⏳') || lastText.toLowerCase().includes('loading')) return "WAITING";
                    return lastText;
                }
                return "WAITING";
            }, query);

            if (result !== "WAITING") break;
            retries++;
        }

        await browser.close();

        return res.status(200).json({
            status: true,
            creator: "KevCodex",
            input: query,
            result: result === "WAITING" ? "Timeout: AI memproses terlalu lama di serverless." : result
        });

    } catch (error) {
        if (browser) await browser.close();
        return res.status(500).json({ status: false, error: error.message });
    }
};
