const { GoogleGenerativeAI } = require("@google/generative-ai");

// Masukkan semua API Key kamu di sini
const apiKeys = [
    "AIzaSyDsFZ3CSg-OSgytA7_N2GBaN6Zqur6QU_Y", // Ini yang suspend
    "AQ.Ab8RN6KZ_N6iOszedkk8DvmV6wIZ10vlqp8yCJLPgDj8BDqg-w" // Masukkan kunci kedua (Pastikan formatnya benar)
];

// Variable untuk melacak mana kunci yang masih hidup
let workingKeys = [...apiKeys];

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Content-Type', 'application/json');

    const query = req.query.text;
    if (!query) return res.status(400).json({ status: false, message: "Query text kosong" });

    const tryGenerate = async () => {
        if (workingKeys.length === 0) {
            throw new Error("Semua API Key sudah mati atau disuspend.");
        }

        // Ambil kunci pertama dari daftar yang masih kerja
        const apiKey = workingKeys[0];
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

        try {
            const result = await model.generateContent(query);
            const response = await result.response;
            return response.text();
        } catch (error) {
            const errorMsg = error.message.toLowerCase();
            
            // Jika error 403 (Suspend) atau 429 (Limit)
            if (errorMsg.includes("403") || errorMsg.includes("429") || errorMsg.includes("suspended")) {
                console.log(`Kunci bermasalah: ${apiKey}. Menghapus dari list...`);
                // Hapus kunci yang rusak dari daftar kerja
                workingKeys.shift(); 
                // Coba lagi dengan kunci berikutnya
                return tryGenerate();
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
        // Jika semua kunci gagal, reset list untuk request berikutnya (siapa tahu cuma limit sementara)
        if (workingKeys.length === 0) workingKeys = [...apiKeys];
        
        return res.status(500).json({ 
            status: false, 
            error: "Semua API Key gagal: " + e.message 
        });
    }
};
