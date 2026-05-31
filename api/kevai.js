const { GoogleGenerativeAI } = require("@google/generative-ai");

// Hanya menggunakan API Key baru yang aktif
const apiKeys = [
    "AIzaSyDvQGTp3Lved3pHTOwsM3jfH26pt17aw88"
];

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
    res.setHeader('Content-Type', 'application/json');

    if (req.method === 'OPTIONS') return res.status(200).end();

    const query = req.query.text;
    if (!query) return res.status(400).json({ status: false, message: "Masukkan parameter ?text=" });

    try {
        // Menggunakan kunci pertama
        const genAI = new GoogleGenerativeAI(apiKeys[0]);
        
        // Memastikan menggunakan versi model yang tepat
        const model = genAI.getGenerativeModel({ 
            model: "gemini-1.5-flash" 
        });

        const result = await model.generateContent({
            contents: [{ role: 'user', parts: [{ text: query }] }]
        });
        
        const response = await result.response;
        const text = response.text();

        return res.status(200).json({
            status: true,
            creator: "KevCodex",
            model: "Gemini 1.5 Flash",
            result: text
        });

    } catch (error) {
        console.error("Error API:", error.message);
        
        // Memberikan pesan error yang lebih jelas jika limit atau suspend lagi
        let userErrorMessage = "Terjadi kesalahan pada sistem AI.";
        if (error.message.includes("429")) userErrorMessage = "Limit API tercapai, coba lagi nanti.";
        if (error.message.includes("403")) userErrorMessage = "API Key ditangguhkan (Suspended).";

        return res.status(500).json({ 
            status: false, 
            error: userErrorMessage,
            raw_message: error.message 
        });
    }
};
