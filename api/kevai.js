const puppeteer = require('puppeteer-core');

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Content-Type', 'application/json');

    const query = req.query.text;
    if (!query) return res.status(400).json({ status: false, message: "Query text kosong" });

    let browser;
    try {
        const token = "2UcGtiiW53vvTQsb34883036c91d61a377ddb72471132d695";
        
        // Menggunakan flag stealth dan menonaktifkan fitur automation yang terdeteksi
        browser = await puppeteer.connect({
            browserWSEndpoint: `wss://chrome.browserless.io?token=${token}&--disable-blink-features=AutomationControlled`,
        });

        const page = await browser.newPage();
        
        // Meniru browser asli secara total
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36');

        // Buka Perchance dengan durasi tunggu yang pas
        await page.goto('https://perchance.org/e5nrresv8a', { 
            waitUntil: 'networkidle2', 
            timeout: 25000 
        });

        // Mencari frame generator (Iframe sering berubah ID-nya)
        const frames = page.frames();
        const worker = frames.find(f => f.url().includes('perchance.org')) || page;

        // Injeksi script untuk pilih model & kirim dalam satu waktu agar cepat
        const isReady = await worker.evaluate((q) => {
            const sel = document.querySelector('select');
            if (sel) {
                const opt = Array.from(sel.options).findIndex(o => o.text.toLowerCase().includes('flash'));
                if (opt !== -1) {
                    sel.selectedIndex = opt;
                    sel.dispatchEvent(new Event('change', { bubbles: true }));
                }
            }
            
            const tx = document.querySelector('textarea');
            const btn = document.querySelector('button[title*="send" i]') || document.querySelector('.input-area button');
            
            if (tx && btn) {
                tx.value = q;
                tx.dispatchEvent(new Event('input', { bubbles: true }));
                btn.click();
                return true;
            }
            return false;
        }, query);

        if (!isReady) throw new Error("Gagal inisialisasi elemen chat.");

        // Ambil Jawaban (Looping maksimal 8 detik)
        let result = "";
        for (let i = 0; i < 12; i++) {
            await new Promise(r => setTimeout(r, 700));
            result = await worker.evaluate((q) => {
                const elements = Array.from(document.querySelectorAll('div, span, p'))
                    .filter(el => {
                        const t = el.innerText.trim();
                        const isUI = ['close', 'clear', 'flash', 'guest', 'new chat'].some(w => t.toLowerCase().includes(w));
                        return t.length > 1 && !isUI && t.toLowerCase() !== q.toLowerCase();
                    });
                
                const lastText = elements[elements.length - 1]?.innerText.trim();
                return (lastText && !lastText.includes('⏳')) ? lastText : "WAIT";
            }, query);
            
            if (result !== "WAIT") break;
        }

        await browser.close();
        return res.status(200).json({ 
            status: true, 
            creator: "KevCodex",
            result: result === "WAIT" ? "AI sedang sibuk, coba lagi." : result 
        });

    } catch (e) {
        if (browser) await browser.close();
        return res.status(500).json({ status: false, error: "System Error: " + e.message });
    }
};
