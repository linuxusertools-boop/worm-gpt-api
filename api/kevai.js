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
            browserWSEndpoint: `wss://chrome.browserless.io?token=${token}&--disable-blink-features=AutomationControlled`,
        });

        const page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36');

        // Buka Perchance
        await page.goto('https://perchance.org/e5nrresv8a', { 
            waitUntil: 'networkidle0', // Menunggu hingga jaringan benar-benar tenang
            timeout: 30000 
        });

        // FUNGSI REKURSIF: Mencari frame yang mengandung textarea chat
        const findChatFrame = () => {
            const frames = page.frames();
            return frames.find(f => f.url().includes('perchance.org') && !f.url().includes('cloudflare'));
        };

        // Tunggu hingga frame tersedia (Max 10 detik)
        let worker = null;
        for (let i = 0; i < 20; i++) {
            worker = findChatFrame();
            if (worker) {
                const hasTextarea = await worker.$('textarea').catch(() => null);
                if (hasTextarea) break;
            }
            await new Promise(r => setTimeout(r, 500));
        }

        if (!worker) throw new Error("Frame chat tidak ditemukan. Coba lagi.");

        // Eksekusi Pilihan Model & Input dalam satu blok agar cepat
        const executionResult = await worker.evaluate((q) => {
            const selectModel = document.querySelector('select');
            if (selectModel) {
                const opt = Array.from(selectModel.options).findIndex(o => o.text.toLowerCase().includes('flash'));
                if (opt !== -1) {
                    selectModel.selectedIndex = opt;
                    selectModel.dispatchEvent(new Event('change', { bubbles: true }));
                }
            }

            const inputArea = document.querySelector('textarea');
            const sendBtn = document.querySelector('button[title*="send" i]') || 
                            document.querySelector('.input-area button') || 
                            document.querySelector('button:has(svg)');

            if (inputArea && sendBtn) {
                inputArea.value = q;
                inputArea.dispatchEvent(new Event('input', { bubbles: true }));
                sendBtn.click();
                return "OK";
            }
            return "ERR_ELEMENT_NOT_FOUND";
        }, query);

        if (executionResult !== "OK") throw new Error("Gagal menginisialisasi input chat.");

        // Pooling Jawaban (Max 10 detik)
        let result = "";
        for (let i = 0; i < 15; i++) {
            await new Promise(r => setTimeout(r, 800));
            result = await worker.evaluate((q) => {
                const bubbles = Array.from(document.querySelectorAll('div, span, p'))
                    .filter(el => {
                        const t = el.innerText.trim();
                        const isUI = ['close', 'clear', 'flash', 'guest', 'new chat', 'memory'].some(w => t.toLowerCase().includes(w));
                        return t.length > 1 && !isUI && t.toLowerCase() !== q.toLowerCase();
                    });
                
                const lastMsg = bubbles[bubbles.length - 1]?.innerText.trim();
                return (lastMsg && !lastMsg.includes('⏳') && !lastMsg.toLowerCase().includes('loading')) ? lastMsg : "WAIT";
            }, query);
            
            if (result !== "WAIT") break;
        }

        await browser.close();

        return res.status(200).json({
            status: true,
            creator: "KevCodex",
            model: "Gemini Flash",
            result: result === "WAIT" ? "AI merespon terlalu lama." : result
        });

    } catch (e) {
        if (browser) await browser.close();
        return res.status(500).json({ status: false, error: "System Error: " + e.message });
    }
};
