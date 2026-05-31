const puppeteer = require('puppeteer-core');

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Content-Type', 'application/json');

    const query = req.query.text;
    if (!query) return res.status(400).json({ status: false, message: "Query text kosong" });

    let browser;
    try {
        const token = "2UcGtiiW53vvTQsb34883036c91d61a377ddb72471132d695";
        
        // Menghubungkan dengan flag khusus untuk menghindari deteksi
        browser = await puppeteer.connect({
            browserWSEndpoint: `wss://chrome.browserless.io?token=${token}&--disable-blink-features=AutomationControlled&--no-sandbox`,
        });

        const page = await browser.newPage();
        
        // Gunakan User Agent yang sangat umum
        await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36');

        // Buka halaman dengan timeout yang lebih longgar untuk mencegah crash
        await page.goto('https://perchance.org/e5nrresv8a', { 
            waitUntil: 'networkidle2', 
            timeout: 30000 
        });

        // Cari frame generator yang aktif
        const frames = page.frames();
        const worker = frames.find(f => f.url().includes('perchance.org')) || page;

        // Otomatisasi: Pilih Gemini Flash dan Kirim Pesan
        const setupSuccess = await worker.evaluate((q) => {
            const sel = document.querySelector('select');
            if (sel) {
                const opt = Array.from(sel.options).findIndex(o => o.text.toLowerCase().includes('flash'));
                if (opt !== -1) {
                    sel.selectedIndex = opt;
                    sel.dispatchEvent(new Event('change', { bubbles: true }));
                }
            }

            const tx = document.querySelector('textarea');
            const btn = document.querySelector('button[title*="send" i]') || 
                        document.querySelector('textarea ~ button') || 
                        document.querySelector('.input-area button');

            if (tx && btn) {
                tx.value = q;
                tx.dispatchEvent(new Event('input', { bubbles: true }));
                btn.click();
                return true;
            }
            return false;
        }, query);

        if (!setupSuccess) throw new Error("Gagal inisialisasi chat. Cek selector.");

        // Ambil Jawaban dengan sistem pooling (Maks 10 detik)
        let result = "";
        for (let i = 0; i < 15; i++) {
            await new Promise(r => setTimeout(r, 700));
            result = await worker.evaluate((q) => {
                const els = Array.from(document.querySelectorAll('div, span, p'))
                    .filter(el => {
                        const t = el.innerText.trim();
                        // Filter teks UI agar tidak masuk ke hasil
                        const isTrash = ['close', 'clear', 'flash', 'guest', 'new chat'].some(w => t.toLowerCase().includes(w));
                        return t.length > 1 && !isTrash && t.toLowerCase() !== q.toLowerCase();
                    });
                
                const last = els[els.length - 1]?.innerText.trim();
                // Tunggu sampai emoji loading ⏳ hilang
                return (last && !last.includes('⏳')) ? last : "WAIT";
            }, query);
            
            if (result !== "WAIT") break;
        }

        await browser.close();

        return res.status(200).json({
            status: true,
            creator: "KevCodex",
            result: result === "WAIT" ? "AI tidak memberikan jawaban tepat waktu." : result
        });

    } catch (e) {
        if (browser) await browser.close();
        return res.status(500).json({ status: false, error: "System Error: " + e.message });
    }
};
            status: true,
            creator: "KevCodex",
            model: "Gemini Flash",
            input: query,
            result: cleanResult
        });

    } catch (e) {
        return res.status(500).json({ 
            status: false, 
            error: "Gagal memproses permintaan: " + e.message 
        });
    }
};
