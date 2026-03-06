const functions = require("firebase-functions");
const admin = require("firebase-admin");
admin.initializeApp();

exports.streamGPTNiX = functions.https.onCall(async (data, context) => {
  const { message, conversationId, userId } = data;

  // Provjera inputa
  if (!message) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "Message is required",
    );
  }

  const db = admin.firestore();
  const messageRef = db
    .collection("conversations")
    .doc(conversationId)
    .collection("messages")
    .doc();

  // Kreiraj prazan AI odgovor
  await messageRef.set({
    id: messageRef.id,
    role: "assistant",
    content: "",
    is_streaming: true,
    created_at: admin.firestore.FieldValue.serverTimestamp(),
    user_id: userId || "anonymous",
  });

  // Nasumičan odabir modela: 90% DeepSeek, 10% GPT
  const random = Math.random();
  let model = "deepseek-chat";
  if (random > 0.9) model = "gpt-4o-mini"; // ili 'gpt-5-mini'

  const apiUrl = model.includes("deepseek")
    ? "https://api.deepseek.com/chat/completions"
    : "https://api.openai.com/v1/chat/completions";

  const apiKey = model.includes("deepseek")
    ? process.env.DEEPSEEK_KEY
    : process.env.OPENAI_KEY;

  const response = await fetch(apiUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content: message }],
      stream: true,
    }),
  });

  const reader = response.body.getReader();
  const decoder = new TextDecoder("utf-8");
  let fullText = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const chunk = decoder.decode(value, { stream: true });
    const lines = chunk
      .split("\n")
      .filter((line) => line.trim().startsWith("data: "));

    for (const line of lines) {
      const data = line.replace(/^data: /, "").trim();
      if (data === "[DONE]") break;

      try {
        const json = JSON.parse(data);
        const token = json.choices?.[0]?.delta?.content || "";
        fullText += token;
        await messageRef.update({ content: fullText });
      } catch (err) {
        console.error("Stream parse error:", err);
      }
    }
  }

  await messageRef.update({ is_streaming: false });
  return { success: true, model_used: model };
});
