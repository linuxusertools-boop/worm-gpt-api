const puppeteer = require('puppeteer-core');

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Content-Type', 'application/json');

    const query = req.query.text;
    if (!query) return res.status(400).json({ status: false, message: "Query text kosong" });

    let browser;
    try {
        const token = "2UcGtiiW53vvTQsb34883036c91d61a377ddb72471132d695";
        browser = await puppeteer.connect({
            browserWSEndpoint: `wss://chrome.browserless.io?token=${token}`,
        });

        const page = await browser.newPage();
        
        // Optimasi: Jangan muat Gambar/CSS agar lebih cepat
        await page.setRequestInterception(true);
        page.on('request', (req) => {
            if (['image', 'stylesheet', 'font'].includes(req.resourceType())) req.abort();
            else req.continue();
        });

        // Paksa buka URL embed agar tidak terhalang UI luar
        await page.goto('https://perchance.org/e5nrresv8a', { waitUntil: 'domcontentloaded' });

        const frames = page.frames();
        const worker = frames.find(f => f.url().includes('perchance.org')) || page;

        // Otomatisasi cepat: Pilih model & Ketik dalam satu eksekusi script
        await worker.evaluate((q) => {
            // Pilih Gemini Flash
            const sel = document.querySelector('select');
            if (sel) {
                const opt = Array.from(sel.options).findIndex(o => o.text.toLowerCase().includes('flash'));
                if (opt !== -1) {
                    sel.selectedIndex = opt;
                    sel.dispatchEvent(new Event('change', { bubbles: true }));
                }
            }
            // Ketik pesan
            const tx = document.querySelector('textarea');
            if (tx) {
                tx.value = q;
                tx.dispatchEvent(new Event('input', { bubbles: true }));
                // Klik tombol kirim
                const btn = document.querySelector('button[title*="send" i]') || document.querySelector('.input-area button');
                if (btn) btn.click();
            }
        }, query);

        // Tunggu jawaban (Pooling singkat 5 detik)
        let result = "";
        for (let i = 0; i < 8; i++) {
            await new Promise(r => setTimeout(r, 600));
            result = await worker.evaluate((q) => {
                const els = Array.from(document.querySelectorAll('div, span, p'))
                    .filter(el => {
                        const t = el.innerText.trim().toLowerCase();
                        return t.length > 1 && !['close', 'clear', 'flash'].some(w => t.includes(w)) && t !== q.toLowerCase();
                    });
                const last = els[els.length - 1]?.innerText.trim();
                return (last && !last.includes('⏳')) ? last : "WAIT";
            }, query);
            if (result !== "WAIT") break;
        }

        await browser.close();
        return res.status(200).json({ status: true, result });

    } catch (e) {
        if (browser) await browser.close();
        return res.status(500).json({ status: false, error: e.message });
    }
};
