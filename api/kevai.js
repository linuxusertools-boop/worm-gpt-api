const { GoogleGenerativeAI } = require("@google/generative-ai");

// Masukkan daftar API Key kamu di sini (Rolling System)
const apiKeys = [
    "AIzaSyDsFZ3CSg-OSgytA7_N2GBaN6Zqur6QU_Y",
    "AQ.Ab8RN6Ji3M0pakUkXmiNFjBJ7p-ctr0FXCqyN_WtJi7lfRM_ig"
    // Tambahkan lagi jika punya cadangan
];

let currentKeyIndex = 0;

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Content-Type', 'application/json');

    const query = req.query.text;
    if (!query) return res.status(400).json({ status: false, message: "Query text kosong" });

    // Fungsi untuk mencoba request dengan kunci yang tersedia
    const tryGenerate = async (attempt = 0) => {
        if (attempt >= apiKeys.length) {
            throw new Error("Semua API Key telah mencapai limit (Quota Exhausted).");
        }

        const apiKey = apiKeys[currentKeyIndex];
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

        try {
            const result = await model.generateContent(query);
            const response = await result.response;
            return response.text();
        } catch (error) {
            // Jika error karena limit (429), pindah ke kunci berikutnya
            if (error.message.includes("429") || error.message.includes("quota")) {
                currentKeyIndex = (currentKeyIndex + 1) % apiKeys.length;
                return tryGenerate(attempt + 1);
            }
            throw error;
        }
    };

    try {
        const aiResponse = await tryGenerate();
        return res.status(200).json({
            status: true,
            creator: "KevCodex",
            model: "Gemini 1.5 Flash",
            result: aiResponse
        });
    } catch (e) {
        return res.status(500).json({ status: false, error: e.message });
    }
};
