module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Content-Type', 'application/json');

    const query = req.query.text;
    if (!query) return res.status(400).json({ status: false, message: "Query text kosong" });

    try {
        // Menggunakan API internal Perchance untuk kecepatan maksimal
        const targetUrl = "https://perchance.org/api/getGeneratorOutput";
        
        // Data payload meniru pengiriman pesan di generator e5nrresv8a
        const params = new URLSearchParams();
        params.append('generatorName', 'e5nrresv8a');
        params.append('userInput', query);
        params.append('selectedModel', 'gemini-flash'); // Memastikan memakai Gemini Flash

        const response = await fetch(targetUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            },
            body: params
        });

        if (!response.ok) throw new Error("Gagal terhubung ke Perchance.");

        const data = await response.json();
        
        // Membersihkan output dari tag HTML jika ada
        const cleanResult = data.output.replace(/<[^>]*>?/gm, '').trim();

        return res.status(200).json({
            status: true,
            creator: "KevCodex",
            model: "Gemini Flash",
            input: query,
            result: cleanResult || "AI tidak memberikan respon."
        });

    } catch (e) {
        return res.status(500).json({ 
            status: false, 
            error: "Error: " + e.message 
        });
    }
};
