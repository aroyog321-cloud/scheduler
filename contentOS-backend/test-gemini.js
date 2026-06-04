require("dotenv").config();
const { GoogleGenerativeAI } = require("@google/generative-ai");

async function test() {
  const apiKey = process.env.GEMINI_API_KEY;
  // Fetch manually via REST since SDK doesn't expose ListModels easily
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
  const data = await res.json();
  console.log("Models:", data.models?.map(m => m.name).join(", "));
}
test();
