module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Content-Type', 'application/json');

    const query = req.query.text;
    if (!query) return res.status(400).json({ status: false, message: "Query text kosong" });

    try {
        // Target internal API Perchance (berdasarkan generator e5nrresv8a)
        const targetUrl = "https://perchance.org/api/getGeneratorOutput";
        
        // Data yang dikirim meniru perilaku Chat UI di gambar Anda
        const payload = new URLSearchParams({
            generatorName: "e5nrresv8a",
            // Parameter instruksi agar AI menjawab sesuai input user
            userInput: query,
            selectedModel: "gemini-flash" 
        });

        const response = await fetch(targetUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36'
            },
            body: payload
        });

        if (!response.ok) throw new Error("Server Perchance menolak koneksi.");

        const data = await response.json();
        
        // Membersihkan output dari tag HTML jika ada
        const cleanResult = data.output.replace(/<[^>]*>?/gm, '').trim();

        return res.status(200).json({
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
