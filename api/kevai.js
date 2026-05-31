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
        
        // Menggunakan User Agent terbaru agar tidak dicurigai sebagai Headless Bot
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36');

        // Menghapus jejak webdriver
        await page.evaluateOnNewDocument(() => {
            Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
        });

        // Buka halaman dengan timeout lebih lama agar Cloudflare selesai mengecek
        await page.goto('https://perchance.org/e5nrresv8a', { 
            waitUntil: 'networkidle2', 
            timeout: 25000 
        });

        // Tunggu sejenak jika ada Interstitial Page dari Cloudflare
        await new Promise(r => setTimeout(r, 2000));

        const frames = page.frames();
        // Mencari frame yang benar-benar berisi konten Perchance, bukan frame iklan/Cloudflare
        const worker = frames.find(f => f.url().includes('perchance.org') && !f.url().includes('cloudflare')) || page;

        // Eksekusi Input
        const success = await worker.evaluate((q) => {
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

        if (!success) throw new Error("Gagal menemukan elemen chat (Mungkin terblokir Cloudflare)");

        // Pooling Jawaban
        let result = "";
        for (let i = 0; i < 10; i++) {
            await new Promise(r => setTimeout(r, 800));
            result = await worker.evaluate((q) => {
                const els = Array.from(document.querySelectorAll('div, span, p'))
                    .filter(el => {
                        const t = el.innerText.trim();
                        // Filter agar tidak mengambil teks UI atau teks pertanyaan sendiri
                        return t.length > 1 && 
                               !['close', 'clear', 'flash', 'performance', 'cloudflare'].some(w => t.toLowerCase().includes(w)) && 
                               t.toLowerCase() !== q.toLowerCase();
                    });
                const last = els[els.length - 1]?.innerText.trim();
                return (last && !last.includes('⏳') && !last.toLowerCase().includes('loading')) ? last : "WAIT";
            }, query);
            if (result !== "WAIT") break;
        }

        await browser.close();
        return res.status(200).json({ 
            status: true, 
            creator: "KevCodex",
            result: result === "WAIT" ? "AI tidak menjawab atau terblokir." : result 
        });

    } catch (e) {
        if (browser) await browser.close();
        return res.status(500).json({ status: false, error: e.message });
    }
};
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
