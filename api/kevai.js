const chromium = require('@sparticuz/chromium-min');
const puppeteer = require('puppeteer-core');

module.exports = async (req, res) => {
    // Mengatur Header CORS agar API bisa diakses dari mana saja (misal untuk Bot WA)
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    const query = req.query.text;
    if (!query) {
        return res.status(400).json({ status: false, message: "Masukkan query teks pada parameter ?text=" });
    }

    let browser;
    try {
        // Lokasi AWS / CDN tempat download binary Chromium yang sudah dikompres
        const executablePath = await chromium.executablePath(
            `https://github.com/sparticuz/chromium/releases/download/v123.0.1/chromium-v123.0.1-pack.tar`
        );

        browser = await puppeteer.launch({
            args: [...chromium.args, '--hide-scrollbars', '--disable-web-security'],
            defaultViewport: { width: 1024, height: 768 },
            executablePath: executablePath,
            headless: chromium.headless,
            ignoreHTTPSErrors: true,
        });

        const page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');

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
