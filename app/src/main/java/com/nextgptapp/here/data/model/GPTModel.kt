package com.nextgptapp.here.data.model

enum class GPTModel(val model: String, val maxTokens: Int) {
    gpt4("gpt-4", 8000),
    gpt35Turbo("gpt-4o-mini", 4000),
    gpt4Turbo("gpt-4o", 16000),
    gpt4Vision("gpt-4o", 8000),
    groq("llama3-70b-8192", 8192),
    gemini("gemini-pro", 8192),
    gemini_1_5_pro("gemini-1.5-pro", 8192), // ✅ Dodano ovo
    deepseek("deepseek-chat-v3", 8192),
    zephyr("zephyr-7b-beta", 4096),
    mistral("mistral-7b-instruct", 4096),
    claude("claude-3-haiku", 200000),
}

