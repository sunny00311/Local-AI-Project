# Offline LLM Android App — Complete System Design Document

> **Project Goal:** Build a fully offline AI chat application for Android that runs a small language model directly on the device, with future expansion to document summarization using RAG (Retrieval-Augmented Generation).

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Hardware Constraints & Model Selection](#2-hardware-constraints--model-selection)
3. [Technology Stack](#3-technology-stack)
4. [Phase 1: Minimal Chat Application](#4-phase-1-minimal-chat-application)
5. [Phase 2: Document Summarization & RAG](#5-phase-2-document-summarization--rag)
6. [Project Structure](#6-project-structure)
7. [Build & Distribution](#7-build--distribution)
8. [Implementation Roadmap](#8-implementation-roadmap)
9. [Code Patterns & Examples](#9-code-patterns--examples)
10. [Troubleshooting & Optimization](#10-troubleshooting--optimization)
11. [Resources & Links](#11-resources--links)

---

## 1. Project Overview

### What We're Building

A **standalone Android application** that:
- Runs a small LLM (Large Language Model) **entirely on-device**
- Works **100% offline** — no internet required after installation
- Bundles the AI model **inside the APK** — no separate download needed
- Stores chat history locally using SQLite
- Later extends to document import and AI-powered summarization

### Why This Matters

- **Privacy:** No data leaves the device
- **Offline-first:** Works anywhere (no WiFi/cellular needed)
- **No API costs:** No per-token charges like cloud APIs
- **Hackathon differentiator:** "Runs completely on your phone" is impressive

### Architecture Philosophy

```
┌─────────────────────────────────────────────────────────────┐
│                     ANDROID DEVICE                          │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              YOUR APP (Single APK)                   │   │
│  │                                                      │   │
│  │   ┌──────────────┐  ┌─────────────┐  ┌───────────┐  │   │
│  │   │   UI Layer   │  │ Logic Layer │  │  Native   │  │   │
│  │   │   (React     │  │  (Hooks,    │  │  Layer    │  │   │
│  │   │   Native)    │  │  Services)  │  │ (llama.   │  │   │
│  │   │              │  │             │  │  cpp/C++) │  │   │
│  │   └──────────────┘  └─────────────┘  └───────────┘  │   │
│  │                                                      │   │
│  │   ┌──────────────────────────────────────────────┐  │   │
│  │   │          BUNDLED ASSETS                       │  │   │
│  │   │  • qwen2.5-0.5b-q4.gguf (Chat Model, ~350MB) │  │   │
│  │   │  • minilm-l6.onnx (Embeddings, ~80MB) [P2]   │  │   │
│  │   └──────────────────────────────────────────────┘  │   │
│  │                                                      │   │
│  │   ┌──────────────────────────────────────────────┐  │   │
│  │   │          LOCAL STORAGE (SQLite)               │  │   │
│  │   │  • conversations table                        │  │   │
│  │   │  • messages table                             │  │   │
│  │   │  • documents table [Phase 2]                  │  │   │
│  │   │  • chunks + vectors table [Phase 2]           │  │   │
│  │   └──────────────────────────────────────────────┘  │   │
│  │                                                      │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. Hardware Constraints & Model Selection

### Target Device Specifications

| Resource | Value | Impact on Design |
|---|---|---|
| **Total RAM** | 4GB | Android OS uses ~2GB, leaving **~1.5-2GB** for the app |
| **Available for Model** | ~1-1.5GB | Must use quantized sub-1B parameter models |
| **CPU** | ARM (Snapdragon/MediaTek) | llama.cpp uses ARM NEON SIMD optimizations |
| **Storage** | Varies | APK size will be ~350-450MB |

### Memory Budget

```
┌────────────────────────────────────────────┐
│           4GB TOTAL DEVICE RAM             │
├────────────────────────────────────────────┤
│  Android OS + System Services   │  ~2.0GB  │
├─────────────────────────────────┼──────────┤
│  LLM Model (Qwen2.5-0.5B Q4)    │  ~600MB  │
├─────────────────────────────────┼──────────┤
│  Embedding Model [Phase 2]      │  ~200MB  │
├─────────────────────────────────┼──────────┤
│  App + UI + SQLite              │  ~100MB  │
├─────────────────────────────────┼──────────┤
│  Vector Cache [Phase 2]         │  ~50MB   │
├─────────────────────────────────┼──────────┤
│  Safety Buffer                  │  ~50MB   │
├─────────────────────────────────┴──────────┤
│  TOTAL: ~3.0GB (fits in 4GB)    ✓          │
└────────────────────────────────────────────┘
```

### Model Options (Ranked by Suitability)

| Model | Parameters | GGUF Size (Q4_K_M) | RAM at Runtime | Quality | Recommendation |
|---|---|---|---|---|---|
| SmolLM2-135M | 135M | ~80MB | ~200MB | Basic, short responses | Too limited |
| SmolLM2-360M | 360M | ~200MB | ~400MB | Decent for simple tasks | Backup option |
| **Qwen2.5-0.5B-Instruct** | 0.5B | ~350MB | ~600MB | Good balance | **Recommended ⭐** |
| TinyLlama-1.1B | 1.1B | ~600MB | ~900MB | Better quality | Tight fit, test first |
| Phi-3-mini (3.8B) | 3.8B | ~2GB | ~3GB | Excellent | **Won't fit ❌** |

### Chosen Model: Qwen2.5-0.5B-Instruct

**Why this model:**
- 500M parameters — small but capable
- Instruction-tuned — follows prompts well
- Q4_K_M quantization — 4-bit precision, ~350MB file
- ~600MB RAM usage — leaves room for the app
- Generates coherent sentences (not just random text)

**Download from:** [HuggingFace - Qwen2.5-0.5B-Instruct-GGUF](https://huggingface.co/Qwen/Qwen2.5-0.5B-Instruct-GGUF)

Look for: `qwen2.5-0.5b-instruct-q4_k_m.gguf`

### What is GGUF?

GGUF (GPT-Generated Unified Format) is a model file format designed for llama.cpp:

```
Original Model (PyTorch)     GGUF (Quantized)
┌─────────────────────┐     ┌─────────────────────┐
│  32-bit floats      │     │  4-bit integers     │
│  ~2GB for 0.5B      │ ──► │  ~350MB for 0.5B    │
│  Needs GPU          │     │  Runs on CPU        │
│  Python/PyTorch     │     │  C++ (llama.cpp)    │
└─────────────────────┘     └─────────────────────┘
```

Quantization trades some accuracy for massive size/speed improvements. Q4_K_M is a good balance.

---

## 3. Technology Stack

### Core Technologies

| Layer | Technology | Purpose |
|---|---|---|
| **UI Framework** | React Native (Expo) | Cross-platform UI (you're already using this) |
| **Build System** | Expo Prebuild + EAS Build | Generate native Android project |
| **LLM Engine** | @runanywhere/llamacpp | React Native LLM inference (replaces llama.rn) |
| **Core SDK** | @runanywhere/core | Model management and infrastructure |
| **Embeddings** | @runanywhere/onnx | Run ONNX models (STT/TTS/Embeddings) [Phase 2] |
| **Database** | expo-sqlite | Local SQLite database |
| **File Access** | expo-document-picker | Import documents [Phase 2] |
| **File System** | expo-file-system | Read/write local files |

### Runanywhere SDK Packages

This implementation uses the **Runanywhere SDK** instead of llama.rn for better abstraction and ease of use:

| Package | Version | Purpose | NPM |
|---------|---------|---------|-----|
| `@runanywhere/core` | ^0.16.10 | Core infrastructure, model management | [View](https://www.npmjs.com/package/@runanywhere/core) |
| `@runanywhere/llamacpp` | ^0.16.10 | LlamaCpp backend for LLM inference | [View](https://www.npmjs.com/package/@runanywhere/llamacpp) |
| `@runanywhere/onnx` | ^0.16.10 | ONNX runtime for embeddings/STT/TTS [Phase 2] | [View](https://www.npmjs.com/package/@runanywhere/onnx) |

**Reference Implementation:** [Runanywhere React Native Starter App](https://github.com/RunanywhereAI/react-native-starter-app)

### Why Can't We Use Expo Go?

**Expo Go** is the app you scan QR codes with during development. It only includes Expo's built-in modules.

**llama.rn** is a **native module** — it contains C++ code that must be compiled into the app. This requires:

```
Expo Go (Limited)              Development Build (Full)
┌─────────────────────┐       ┌─────────────────────┐
│  Pre-compiled       │       │  Custom compiled    │
│  Only Expo modules  │  vs   │  Any native module  │
│  Quick to start     │       │  Requires build     │
│  No C++/native code │       │  Full flexibility   │
└─────────────────────┘       └─────────────────────┘
         ❌                            ✓
   Won't work with              Required for
      llama.rn                    this project
```

### Required Setup (One-Time)

1. **Android Studio** — For Android SDK, emulator, and build tools
2. **Java JDK 17** — Android build requirement
3. **Node.js 18+** — You likely have this already

---

## 4. Phase 1: Minimal Chat Application

### Phase 1 Goals

- [ ] Load an LLM model on app startup
- [ ] Display a chat interface (message list + input)
- [ ] Send user messages to the LLM
- [ ] Display AI responses (with streaming)
- [ ] Persist chat history to SQLite
- [ ] Handle loading states and errors

### Architecture Diagram (Phase 1)

```
┌─────────────────────────────────────────────────────────────────┐
│                    PHASE 1 ARCHITECTURE                         │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                   PRESENTATION LAYER                     │   │
│  │                                                          │   │
│  │   ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │   │
│  │   │  ChatScreen  │  │ MessageList  │  │  InputBar    │  │   │
│  │   │              │  │  (FlatList)  │  │  (TextInput  │  │   │
│  │   │  Main screen │  │              │  │   + Button)  │  │   │
│  │   │  container   │  │  Renders     │  │              │  │   │
│  │   │              │  │  ChatBubble  │  │  Send action │  │   │
│  │   └──────┬───────┘  └──────────────┘  └──────────────┘  │   │
│  │          │                                               │   │
│  └──────────┼───────────────────────────────────────────────┘   │
│             │                                                   │
│             ▼                                                   │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                     LOGIC LAYER (Hooks)                  │   │
│  │                                                          │   │
│  │   ┌──────────────────────────────────────────────────┐  │   │
│  │   │                  useLLMChat                       │  │   │
│  │   │                                                   │  │   │
│  │   │  State:                                           │  │   │
│  │   │  - messages: Message[]                            │  │   │
│  │   │  - isGenerating: boolean                          │  │   │
│  │   │  - isModelLoaded: boolean                         │  │   │
│  │   │                                                   │  │   │
│  │   │  Actions:                                         │  │   │
│  │   │  - sendMessage(text: string)                      │  │   │
│  │   │  - cancelGeneration()                             │  │   │
│  │   │  - clearHistory()                                 │  │   │
│  │   └──────────────────────┬───────────────────────────┘  │   │
│  │                          │                               │   │
│  └──────────────────────────┼───────────────────────────────┘   │
│                             │                                   │
│                             ▼                                   │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                    SERVICE LAYER                         │   │
│  │                                                          │   │
│  │   ┌─────────────────────┐   ┌─────────────────────────┐ │   │
│  │   │     LLMService      │   │   DatabaseService       │ │   │
│  │   │                     │   │                         │ │   │
│  │   │  - initModel()      │   │  - initDB()             │ │   │
│  │   │  - generate(prompt) │   │  - saveMessage(msg)     │ │   │
│  │   │  - unloadModel()    │   │  - getMessages(convId)  │ │   │
│  │   │  - isLoaded()       │   │  - createConversation() │ │   │
│  │   │                     │   │  - deleteConversation() │ │   │
│  │   └──────────┬──────────┘   └─────────────────────────┘ │   │
│  │              │                                           │   │
│  └──────────────┼───────────────────────────────────────────┘   │
│                 │                                               │
│                 ▼                                               │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                     NATIVE LAYER                         │   │
│  │                                                          │   │
│  │   ┌──────────────────────────────────────────────────┐  │   │
│  │   │                   llama.rn                        │  │   │
│  │   │                                                   │  │   │
│  │   │  JavaScript API ───► JSI Bridge ───► C++ Code    │  │   │
│  │   │                                                   │  │   │
│  │   │  Functions:                                       │  │   │
│  │   │  - initLlama({ model, n_ctx, n_threads })        │  │   │
│  │   │  - context.completion({ prompt, ... })            │  │   │
│  │   │  - context.release()                              │  │   │
│  │   └──────────────────────────────────────────────────┘  │   │
│  │                                                          │   │
│  │   ┌──────────────────────────────────────────────────┐  │   │
│  │   │              BUNDLED MODEL FILE                   │  │   │
│  │   │                                                   │  │   │
│  │   │    assets/models/qwen2.5-0.5b-q4.gguf            │  │   │
│  │   │    (~350MB, copied to device on install)          │  │   │
│  │   └──────────────────────────────────────────────────┘  │   │
│  │                                                          │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Data Flow (User Sends a Message)

```
User types "What is AI?"
         │
         ▼
┌─────────────────────┐
│  1. InputBar gets   │
│     text, calls     │
│     sendMessage()   │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  2. useLLMChat      │
│     - Adds user msg │
│       to state      │
│     - Sets          │
│       isGenerating  │
│       = true        │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  3. DatabaseService │
│     - Saves user    │
│       message to    │
│       SQLite        │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  4. LLMService      │
│     - Builds prompt │
│       with history  │
│     - Calls         │
│       llama.rn      │
│       completion()  │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  5. llama.rn        │
│     - Tokenizes     │
│     - Runs inference│
│     - Returns text  │
│       (or streams)  │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  6. useLLMChat      │
│     - Adds AI msg   │
│       to state      │
│     - Sets          │
│       isGenerating  │
│       = false       │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  7. DatabaseService │
│     - Saves AI      │
│       response to   │
│       SQLite        │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  8. UI Updates      │
│     - MessageList   │
│       re-renders    │
│     - New bubble    │
│       appears       │
└─────────────────────┘
```

### Prompt Template Format

The LLM needs a structured prompt format. Qwen uses this format:

```
<|im_start|>system
You are a helpful AI assistant.
<|im_end|>
<|im_start|>user
What is artificial intelligence?
<|im_end|>
<|im_start|>assistant
```

The model continues from `<|im_start|>assistant` and generates a response.

**Building the prompt from chat history:**

```javascript
function buildPrompt(messages, systemPrompt = "You are a helpful AI assistant.") {
  let prompt = `<|im_start|>system\n${systemPrompt}\n<|im_end|>\n`;
  
  for (const msg of messages) {
    prompt += `<|im_start|>${msg.role}\n${msg.content}\n<|im_end|>\n`;
  }
  
  prompt += `<|im_start|>assistant\n`;
  return prompt;
}
```

### Database Schema (Phase 1)

```sql
-- Conversations table
CREATE TABLE IF NOT EXISTS conversations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT DEFAULT 'New Chat',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Messages table
CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    conversation_id INTEGER NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('user', 'assistant', 'system')),
    content TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
);

-- Index for faster queries
CREATE INDEX IF NOT EXISTS idx_messages_conversation 
ON messages(conversation_id);
```

### Key Phase 1 Decisions

| Decision | Choice | Rationale |
|---|---|---|
| **When to load model** | On app start | Avoid delay when user sends first message |
| **Loading indicator** | Full-screen splash | Model loading takes 5-15 seconds |
| **Context window** | 512-1024 tokens | Balance between history and RAM |
| **History in prompt** | Last 5-10 messages | Don't overflow context window |
| **Token streaming** | Yes | Makes slow generation feel faster |
| **Cancel generation** | Yes, essential | Users need control over slow responses |

---

## 5. Phase 2: Document Summarization & RAG

### Phase 2 Goals

- [ ] Import PDF/TXT documents
- [ ] Parse documents to plain text
- [ ] Split text into chunks
- [ ] Generate embeddings for each chunk
- [ ] Store chunks + embeddings in SQLite
- [ ] Implement RAG query pipeline
- [ ] Display source references in answers

### What is RAG?

**RAG (Retrieval-Augmented Generation)** enhances an LLM by giving it relevant context from your documents.

```
Without RAG:                      With RAG:
┌────────────────────┐            ┌────────────────────┐
│ User: "What did    │            │ User: "What did    │
│ the report say     │            │ the report say     │
│ about sales?"      │            │ about sales?"      │
└─────────┬──────────┘            └─────────┬──────────┘
          │                                 │
          ▼                                 ▼
┌────────────────────┐            ┌────────────────────┐
│ LLM has no idea    │            │ 1. Embed query     │
│ what report        │            │ 2. Search vectors  │
│                    │            │ 3. Find: "Q3 sales │
│ Response: "I don't │            │    increased 15%"  │
│ have access to     │            │ 4. Add to prompt   │
│ your documents"    │            └─────────┬──────────┘
└────────────────────┘                      │
                                            ▼
                                  ┌────────────────────┐
                                  │ LLM sees context:  │
                                  │ "Based on the doc, │
                                  │  Q3 sales were up  │
                                  │  15% compared to   │
                                  │  Q2..."            │
                                  └────────────────────┘
```

### RAG Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                    PHASE 2: RAG PIPELINE                        │
│                                                                 │
│  ══════════════════ DOCUMENT INGESTION ══════════════════════  │
│                                                                 │
│   ┌──────────────┐    ┌──────────────┐    ┌──────────────┐     │
│   │   User       │    │   Parse to   │    │   Split      │     │
│   │   Imports    │───►│   Plain      │───►│   into       │     │
│   │   PDF/TXT    │    │   Text       │    │   Chunks     │     │
│   └──────────────┘    └──────────────┘    └──────┬───────┘     │
│                                                  │              │
│                                                  ▼              │
│   ┌─────────────────────────────────────────────────────────┐  │
│   │                   EMBEDDING MODEL                        │  │
│   │         (all-MiniLM-L6-v2 via ONNX Runtime)             │  │
│   │                                                          │  │
│   │   "Q3 sales increased 15%"  ───►  [0.12, -0.45, ...]    │  │
│   │          (text)                    (384-dim vector)      │  │
│   └─────────────────────────────────────────┬───────────────┘  │
│                                             │                   │
│                                             ▼                   │
│   ┌─────────────────────────────────────────────────────────┐  │
│   │                   VECTOR STORAGE (SQLite)                │  │
│   │                                                          │  │
│   │   chunks table:                                          │  │
│   │   ┌────┬────────┬─────────────────┬──────────────────┐  │  │
│   │   │ id │ doc_id │ text            │ embedding (BLOB) │  │  │
│   │   ├────┼────────┼─────────────────┼──────────────────┤  │  │
│   │   │ 1  │ 1      │ "Q3 sales..." │ [binary data]    │  │  │
│   │   │ 2  │ 1      │ "Revenue..."  │ [binary data]    │  │  │
│   │   └────┴────────┴─────────────────┴──────────────────┘  │  │
│   └─────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ══════════════════ QUERY TIME (RAG) ════════════════════════  │
│                                                                 │
│   ┌──────────────┐                                              │
│   │ User Query:  │                                              │
│   │ "What were   │                                              │
│   │ Q3 sales?"   │                                              │
│   └──────┬───────┘                                              │
│          │                                                      │
│          ▼                                                      │
│   ┌─────────────────────────────────────────────────────────┐  │
│   │  1. EMBED QUERY                                          │  │
│   │     "What were Q3 sales?" ──► [0.15, -0.42, ...]        │  │
│   └─────────────────────────────────────┬───────────────────┘  │
│                                         │                       │
│                                         ▼                       │
│   ┌─────────────────────────────────────────────────────────┐  │
│   │  2. VECTOR SEARCH                                        │  │
│   │     Compare query vector to all chunk vectors            │  │
│   │     Using cosine similarity                              │  │
│   │     Return top 3-5 most similar chunks                   │  │
│   └─────────────────────────────────────┬───────────────────┘  │
│                                         │                       │
│                                         ▼                       │
│   ┌─────────────────────────────────────────────────────────┐  │
│   │  3. BUILD AUGMENTED PROMPT                               │  │
│   │                                                          │  │
│   │  <|im_start|>system                                      │  │
│   │  Answer based on the following context:                  │  │
│   │                                                          │  │
│   │  Context 1: "Q3 sales increased by 15% compared to Q2,  │  │
│   │  reaching $2.3 million in revenue..."                    │  │
│   │                                                          │  │
│   │  Context 2: "The sales team expanded into new markets   │  │
│   │  including Southeast Asia..."                            │  │
│   │  <|im_end|>                                              │  │
│   │  <|im_start|>user                                        │  │
│   │  What were Q3 sales?                                     │  │
│   │  <|im_end|>                                              │  │
│   │  <|im_start|>assistant                                   │  │
│   └─────────────────────────────────────┬───────────────────┘  │
│                                         │                       │
│                                         ▼                       │
│   ┌─────────────────────────────────────────────────────────┐  │
│   │  4. LLM GENERATION                                       │  │
│   │     Model generates answer using the context             │  │
│   │                                                          │  │
│   │     "According to the Q3 report, sales increased by     │  │
│   │      15% compared to Q2, reaching $2.3 million."         │  │
│   └─────────────────────────────────────────────────────────┘  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Chunking Strategy

Documents must be split into chunks because:
1. Embedding models have token limits (~512 tokens)
2. Smaller chunks = more precise retrieval
3. LLM context window is limited

```
┌────────────────────────────────────────────────────────────┐
│                    ORIGINAL DOCUMENT                        │
│                                                             │
│  The company reported strong financial results for Q3.     │
│  Revenue increased by 15% compared to the previous         │
│  quarter, reaching $2.3 million. This growth was           │
│  primarily driven by expansion into Southeast Asian        │
│  markets, where the company established partnerships       │
│  with three major distributors. The sales team also        │
│  implemented a new customer retention program that         │
│  reduced churn by 8%. Looking ahead to Q4, management      │
│  expects continued growth...                                │
│                                                             │
└────────────────────────────────────────────────────────────┘
                              │
                              ▼
                      CHUNKING (with overlap)
                              │
         ┌────────────────────┼────────────────────┐
         ▼                    ▼                    ▼
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│ CHUNK 1         │  │ CHUNK 2         │  │ CHUNK 3         │
│                 │  │                 │  │                 │
│ The company     │  │ ...reaching     │  │ ...new customer │
│ reported strong │  │ $2.3 million.   │  │ retention       │
│ financial       │  │ This growth was │  │ program that    │
│ results for Q3. │  │ primarily       │  │ reduced churn   │
│ Revenue         │  │ driven by       │  │ by 8%. Looking  │
│ increased by    │  │ expansion into  │  │ ahead to Q4...  │
│ 15%...          │  │ Southeast...    │  │                 │
│                 │  │                 │  │                 │
│ [300 tokens]    │  │ [300 tokens]    │  │ [300 tokens]    │
│ [overlap: 50]   │  │ [overlap: 50]   │  │                 │
└─────────────────┘  └─────────────────┘  └─────────────────┘
```

**Chunking parameters:**
- **Chunk size:** 300-500 tokens
- **Overlap:** 50-100 tokens (captures context across boundaries)
- **Separator:** Split on sentences or paragraphs when possible

### Embedding Model Selection

| Model | Size | Dimensions | Quality | Speed |
|---|---|---|---|---|
| all-MiniLM-L6-v2 | ~80MB | 384 | Good | Fast ⭐ |
| bge-small-en | ~130MB | 384 | Better | Medium |
| nomic-embed-text | ~250MB | 768 | Best | Slower |

**Recommended:** `all-MiniLM-L6-v2` — small, fast, good quality for RAG.

### Database Schema (Phase 2 Additions)

```sql
-- Documents table
CREATE TABLE IF NOT EXISTS documents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    filename TEXT NOT NULL,
    filetype TEXT NOT NULL,  -- 'pdf', 'txt', etc.
    content TEXT,            -- Full text content
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Chunks table with embeddings
CREATE TABLE IF NOT EXISTS chunks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    document_id INTEGER NOT NULL,
    chunk_index INTEGER NOT NULL,  -- Order within document
    content TEXT NOT NULL,
    embedding BLOB NOT NULL,       -- 384 floats as binary
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE
);

-- Index for document lookups
CREATE INDEX IF NOT EXISTS idx_chunks_document 
ON chunks(document_id);
```

### Vector Search (Simple In-Memory Approach)

For a hackathon with <10,000 chunks, simple JavaScript cosine similarity is fine:

```javascript
function cosineSimilarity(vecA, vecB) {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

function searchSimilarChunks(queryEmbedding, allChunks, topK = 5) {
  const scored = allChunks.map(chunk => ({
    ...chunk,
    score: cosineSimilarity(queryEmbedding, chunk.embedding)
  }));
  
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, topK);
}
```

---

## 6. Project Structure

### Recommended File Organization

```
my-app/
├── app/                              # Expo Router screens
│   ├── _layout.tsx                   # Root layout
│   ├── (tabs)/
│   │   ├── _layout.tsx               # Tab bar config
│   │   ├── index.tsx                 # Chat screen (main)
│   │   ├── documents.tsx             # Document library [Phase 2]
│   │   ├── history.tsx               # Conversation history
│   │   └── settings.tsx              # Model/app settings
│   ├── chat/
│   │   └── [conversationId].tsx      # Individual chat view
│   └── document/
│       └── [documentId].tsx          # Document detail [Phase 2]
│
├── components/
│   ├── chat/
│   │   ├── MessageList.tsx           # Renders messages
│   │   ├── ChatBubble.tsx            # Single message bubble
│   │   ├── InputBar.tsx              # Text input + send
│   │   ├── TypingIndicator.tsx       # AI thinking animation
│   │   └── SourceReference.tsx       # RAG source cite [Phase 2]
│   ├── documents/                    # [Phase 2]
│   │   ├── DocumentCard.tsx
│   │   ├── DocumentPicker.tsx
│   │   └── ChunkPreview.tsx
│   └── ui/
│       ├── LoadingScreen.tsx         # Model loading splash
│       └── ...existing components
│
├── services/
│   ├── llm/
│   │   ├── index.ts                  # LLMService class
│   │   ├── prompts.ts                # Prompt templates
│   │   └── config.ts                 # Model parameters
│   ├── database/
│   │   ├── index.ts                  # DatabaseService class
│   │   ├── migrations.ts             # Schema versioning
│   │   └── queries.ts                # SQL query helpers
│   ├── embeddings/                   # [Phase 2]
│   │   ├── index.ts                  # EmbeddingService
│   │   └── vectorSearch.ts           # Similarity search
│   └── documents/                    # [Phase 2]
│       ├── parser.ts                 # PDF/TXT parsing
│       ├── chunker.ts                # Text splitting
│       └── importer.ts               # Import pipeline
│
├── hooks/
│   ├── useLLMChat.ts                 # Chat state management
│   ├── useModelLoader.ts             # Model lifecycle
│   ├── useConversations.ts           # History management
│   ├── useDocuments.ts               # [Phase 2]
│   └── useRAG.ts                     # [Phase 2] RAG pipeline
│
├── contexts/
│   └── LLMContext.tsx                # Global model state
│
├── types/
│   ├── chat.ts                       # Message, Conversation types
│   ├── llm.ts                        # Model-related types
│   └── documents.ts                  # [Phase 2]
│
├── assets/
│   ├── models/                       # ⚠️ BUNDLED MODELS
│   │   ├── qwen2.5-0.5b-q4.gguf     # Chat model (~350MB)
│   │   └── minilm-l6.onnx           # Embeddings [Phase 2] (~80MB)
│   └── images/
│
├── constants/
│   └── llm.ts                        # Model paths, params
│
├── android/                          # Generated by expo prebuild
│   └── app/src/main/assets/models/   # Models copied here
│
├── app.json                          # Expo config
├── package.json
├── tsconfig.json
└── metro.config.js                   # Bundler config (for .gguf files)
```

---

## 7. Build & Distribution

### Development Workflow Comparison

```
BEFORE (Expo Go):                 AFTER (Development Build):
┌────────────────────┐            ┌────────────────────┐
│  npx expo start    │            │  npx expo prebuild │
│         │          │            │         │          │
│         ▼          │            │         ▼          │
│  Scan QR with      │            │  android/ folder   │
│  Expo Go app       │            │  is created        │
│         │          │            │         │          │
│         ▼          │            │         ▼          │
│  App runs in       │     vs     │  npx expo run:     │
│  Expo Go sandbox   │            │  android           │
│         │          │            │         │          │
│         ▼          │            │         ▼          │
│  ❌ No native      │            │  Custom app builds │
│     modules        │            │  and installs      │
└────────────────────┘            │         │          │
                                  │         ▼          │
                                  │  ✓ Native modules  │
                                  │    (llama.rn) work │
                                  └────────────────────┘
```

### Setting Up for Native Builds

**Step 1: Install Android Studio**
- Download from: https://developer.android.com/studio
- Install Android SDK (API 34+)
- Install NDK (for C++ compilation)
- Set up an emulator or connect a physical device

**Step 2: Environment Variables (Windows)**
```powershell
# Add to system environment variables:
ANDROID_HOME = C:\Users\YourName\AppData\Local\Android\Sdk
JAVA_HOME = C:\Program Files\Eclipse Adoptium\jdk-17...

# Add to PATH:
%ANDROID_HOME%\platform-tools
%ANDROID_HOME%\emulator
```

**Step 3: Generate Native Project**
```bash
# In your project directory:
npx expo prebuild

# This creates:
# - android/   (native Android project)
# - ios/       (native iOS project, if on Mac)
```

**Step 4: Build and Run**
```bash
# Run on connected device or emulator:
npx expo run:android

# Or build APK directly with Gradle:
cd android
./gradlew assembleDebug

# APK location:
# android/app/build/outputs/apk/debug/app-debug.apk
```

### Bundling the Model in APK

The model file needs to be included in the APK assets:

**Option A: Android assets folder**
```
android/app/src/main/assets/models/
└── qwen2.5-0.5b-q4.gguf
```

**Option B: Configure in app.json (Expo)**
```json
{
  "expo": {
    "android": {
      "assets": ["./assets/models"]
    }
  }
}
```

**Option C: Metro bundler config (for Expo)**
```javascript
// metro.config.js
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Add .gguf and .onnx as asset extensions
config.resolver.assetExts.push('gguf', 'onnx');

module.exports = config;
```

### APK Size Breakdown

```
┌────────────────────────────────────────────────┐
│              FINAL APK SIZE                    │
├────────────────────────────────────────────────┤
│  React Native runtime        │     ~15 MB     │
│  JavaScript bundle           │      ~3 MB     │
│  llama.rn native library     │      ~5 MB     │
│  Chat model (GGUF)           │    ~350 MB     │
│  [Phase 2] Embed model       │     ~80 MB     │
│  Other assets/resources      │      ~2 MB     │
├────────────────────────────────────────────────┤
│  TOTAL Phase 1               │   ~375 MB      │
│  TOTAL Phase 2               │   ~455 MB      │
└────────────────────────────────────────────────┘
```

**Note:** Google Play Store has a 150MB limit for APKs. Solutions:
- For hackathon: Sideload APK directly (no limit)
- For production: Use Android App Bundle (AAB) + Play Asset Delivery

---

## 8. Implementation Roadmap

### Phase 1 Breakdown

| Step | Task | Time Est. | Dependencies |
|---|---|---|---|
| **1.1** | Install Android Studio + SDK | 30-60 min | None |
| **1.2** | Run `npx expo prebuild` | 5 min | Step 1.1 |
| **1.3** | Add `llama.rn` to project | 15 min | Step 1.2 |
| **1.4** | Download GGUF model file | 10-30 min | Internet |
| **1.5** | Configure model bundling | 30 min | Steps 1.3, 1.4 |
| **1.6** | Create LLMService | 1-2 hours | Step 1.5 |
| **1.7** | Create DatabaseService for chat | 1 hour | expo-sqlite |
| **1.8** | Create loading splash screen | 30 min | None |
| **1.9** | Build chat UI components | 1-2 hours | None |
| **1.10** | Create useLLMChat hook | 1-2 hours | Steps 1.6, 1.7 |
| **1.11** | Integrate chat screen | 1 hour | Steps 1.9, 1.10 |
| **1.12** | Test on device | 1 hour | All above |
| **1.13** | Add streaming responses | 1 hour | Step 1.12 |
| **1.14** | Add conversation history | 1-2 hours | Step 1.12 |

**Phase 1 Total: ~10-15 hours**

### Phase 2 Breakdown

| Step | Task | Time Est. | Dependencies |
|---|---|---|---|
| **2.1** | Add `onnxruntime-react-native` | 30 min | Phase 1 |
| **2.2** | Download MiniLM ONNX model | 10 min | Internet |
| **2.3** | Create EmbeddingService | 2 hours | Step 2.2 |
| **2.4** | Add document picker UI | 1 hour | expo-document-picker |
| **2.5** | Create document parser | 2-3 hours | PDF library |
| **2.6** | Create chunking logic | 1-2 hours | None |
| **2.7** | Update database schema | 30 min | None |
| **2.8** | Create import pipeline | 2 hours | Steps 2.3-2.7 |
| **2.9** | Create vector search | 1-2 hours | Step 2.3 |
| **2.10** | Create RAG prompt builder | 1 hour | None |
| **2.11** | Integrate RAG into chat | 2 hours | Steps 2.9, 2.10 |
| **2.12** | Add source references UI | 1-2 hours | Step 2.11 |

**Phase 2 Total: ~15-20 hours**

### Priority Order (For Hackathon)

If time is limited, implement in this order:

1. **Must Have:** Steps 1.1-1.11 (working chat)
2. **Should Have:** Steps 1.13-1.14 (polished UX)
3. **Nice to Have:** Phase 2 (RAG features)

---

## 9. Code Patterns & Examples

### LLMService Pattern (Runanywhere SDK)

```typescript
// services/llm/LLMService.ts
import { LlamaCpp } from '@runanywhere/llamacpp';
import type { LlamaCppModel, GenerateOptions } from '@runanywhere/llamacpp';

class LLMService {
  private model: LlamaCppModel | null = null;
  private isInitialized = false;

  async initialize(modelId: string): Promise<void> {
    if (this.isInitialized) return;
    
    try {
      // Load the model that was registered by ModelService
      this.model = await LlamaCpp.loadModel(modelId);
      this.isInitialized = true;
      console.log('LLM Model loaded successfully');
    } catch (error) {
      console.error('Failed to load LLM model:', error);
      throw error;
    }
  }

  async generate(
    prompt: string,
    options: Partial<GenerateOptions> = {},
    onToken?: (token: string) => void
  ): Promise<string> {
    if (!this.model) {
      throw new Error('Model not initialized. Call initialize() first.');
    }

    const defaultOptions: GenerateOptions = {
      maxTokens: 256,
      temperature: 0.7,
      topP: 0.9,
      topK: 40,
      repeatPenalty: 1.1,
      stopSequences: ['<|im_end|>'],
    };

    const finalOptions = { ...defaultOptions, ...options };

    try {
      let fullResponse = '';
      
      // Stream tokens from the model
      await this.model.generate(prompt, finalOptions, (token: string) => {
        fullResponse += token;
        if (onToken) {
          onToken(token);
        }
      });

      return fullResponse;
    } catch (error) {
      console.error('Generation failed:', error);
      throw error;
    }
  }

  async release(): Promise<void> {
    if (this.model) {
      await LlamaCpp.unloadModel(this.model.id);
      this.model = null;
      this.isInitialized = false;
    }
  }

  get isReady(): boolean {
    return this.isInitialized && this.model !== null;
  }
}

export const llmService = new LLMService();
```

### useLLMChat Hook Pattern

```typescript
// hooks/useLLMChat.ts
import { useState, useCallback, useEffect } from 'react';
import { llmService } from '@/services/llm';
import { databaseService } from '@/services/database';
import { buildPrompt } from '@/services/llm/prompts';

interface Message {
  id?: number;
  role: 'user' | 'assistant';
  content: string;
}

export function useLLMChat(conversationId: number) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');

  // Load history on mount
  useEffect(() => {
    const loadHistory = async () => {
      const history = await databaseService.getMessages(conversationId);
      setMessages(history);
    };
    loadHistory();
  }, [conversationId]);

  const sendMessage = useCallback(async (content: string) => {
    // 1. Add user message
    const userMessage: Message = { role: 'user', content };
    setMessages(prev => [...prev, userMessage]);
    await databaseService.saveMessage(conversationId, userMessage);

    // 2. Start generation
    setIsGenerating(true);
    setStreamingContent('');

    try {
      // 3. Build prompt with history
      const prompt = buildPrompt([...messages, userMessage]);

      // 4. Generate with streaming
      let fullResponse = '';
      await llmService.generate(prompt, (token) => {
        fullResponse += token;
        setStreamingContent(fullResponse);
      });

      // 5. Add assistant message
      const assistantMessage: Message = { role: 'assistant', content: fullResponse };
      setMessages(prev => [...prev, assistantMessage]);
      await databaseService.saveMessage(conversationId, assistantMessage);

    } catch (error) {
      console.error('Generation failed:', error);
      // Handle error in UI
    } finally {
      setIsGenerating(false);
      setStreamingContent('');
    }
  }, [conversationId, messages]);

  return {
    messages,
    isGenerating,
    streamingContent,
    sendMessage,
  };
}
```

### Prompt Builder Pattern

```typescript
// services/llm/prompts.ts

interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

const DEFAULT_SYSTEM_PROMPT = `You are a helpful AI assistant. Be concise and accurate.`;

export function buildPrompt(
  messages: Message[],
  systemPrompt: string = DEFAULT_SYSTEM_PROMPT
): string {
  let prompt = `<|im_start|>system\n${systemPrompt}\n<|im_end|>\n`;

  // Only include last N messages to fit context window
  const recentMessages = messages.slice(-10);

  for (const msg of recentMessages) {
    prompt += `<|im_start|>${msg.role}\n${msg.content}\n<|im_end|>\n`;
  }

  prompt += `<|im_start|>assistant\n`;
  return prompt;
}

// For RAG (Phase 2)
export function buildRAGPrompt(
  query: string,
  contexts: string[],
  systemPrompt: string = DEFAULT_SYSTEM_PROMPT
): string {
  const contextSection = contexts
    .map((ctx, i) => `[Source ${i + 1}]: ${ctx}`)
    .join('\n\n');

  const ragSystemPrompt = `${systemPrompt}

Use the following context to answer the user's question. If the context doesn't contain relevant information, say so.

Context:
${contextSection}`;

  return buildPrompt(
    [{ role: 'user', content: query }],
    ragSystemPrompt
  );
}
```

### Database Service Pattern

```typescript
// services/database/index.ts
import * as SQLite from 'expo-sqlite';

class DatabaseService {
  private db: SQLite.SQLiteDatabase | null = null;

  async initialize(): Promise<void> {
    this.db = await SQLite.openDatabaseAsync('app.db');

    await this.db.execAsync(`
      CREATE TABLE IF NOT EXISTS conversations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT DEFAULT 'New Chat',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        conversation_id INTEGER NOT NULL,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
      );
    `);
  }

  async createConversation(title?: string): Promise<number> {
    const result = await this.db!.runAsync(
      'INSERT INTO conversations (title) VALUES (?)',
      [title || 'New Chat']
    );
    return result.lastInsertRowId;
  }

  async getMessages(conversationId: number): Promise<Message[]> {
    return await this.db!.getAllAsync<Message>(
      'SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC',
      [conversationId]
    );
  }

  async saveMessage(conversationId: number, message: Message): Promise<number> {
    const result = await this.db!.runAsync(
      'INSERT INTO messages (conversation_id, role, content) VALUES (?, ?, ?)',
      [conversationId, message.role, message.content]
    );

    // Update conversation timestamp
    await this.db!.runAsync(
      'UPDATE conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [conversationId]
    );

    return result.lastInsertRowId;
  }

  async deleteConversation(conversationId: number): Promise<void> {
    await this.db!.runAsync(
      'DELETE FROM conversations WHERE id = ?',
      [conversationId]
    );
  }
}

export const databaseService = new DatabaseService();
```

---

## 10. Troubleshooting & Optimization

### Common Issues & Solutions

| Problem | Cause | Solution |
|---|---|---|
| **App crashes on model load** | Not enough RAM | Use smaller model (SmolLM-360M) |
| **Model file not found** | Asset not bundled | Check metro.config.js, rebuild |
| **Very slow generation** | Too many threads | Reduce n_threads to 2-4 |
| **Out of memory during chat** | Context too large | Reduce n_ctx to 512 |
| **Garbled output** | Wrong prompt format | Use correct chat template |
| **Build fails with NDK error** | Missing NDK | Install via Android Studio |

### Performance Optimization

```typescript
// Optimization settings for 4GB RAM devices

const OPTIMIZED_CONFIG = {
  // Model loading
  n_ctx: 512,           // Smaller context = less RAM
  n_threads: 4,         // Match CPU cores (not more)
  n_batch: 64,          // Smaller batch = less RAM per step
  
  // Generation
  n_predict: 128,       // Shorter responses = faster
  temperature: 0.7,     // Higher = more random (not faster)
  
  // Memory management
  use_mmap: true,       // Memory-map model file (default)
  use_mlock: false,     // Don't lock in RAM (let OS manage)
};
```

### Testing Recommendations

1. **Test on real device** — Emulators don't reflect true RAM limits
2. **Test cold start** — Model loading time matters for UX
3. **Test long conversations** — Memory accumulates
4. **Test backgrounding** — Android may kill the model context
5. **Test kill/restart** — Chat history should persist

---

## 11. Resources & Links

### Model Downloads

| Model | Link | Size |
|---|---|---|
| Qwen2.5-0.5B-Instruct (Q4_K_M) | [HuggingFace](https://huggingface.co/Qwen/Qwen2.5-0.5B-Instruct-GGUF) | ~350MB |
| SmolLM2-360M (Q4_K_M) | [HuggingFace](https://huggingface.co/HuggingFaceTB/SmolLM2-360M-Instruct-GGUF) | ~200MB |
| all-MiniLM-L6-v2 (ONNX) | [HuggingFace](https://huggingface.co/sentence-transformers/all-MiniLM-L6-v2) | ~80MB |

### Libraries Documentation

| Library | Purpose | Docs |
|---|---|---|
| llama.rn | Run GGUF models in RN | [GitHub](https://github.com/mybigday/llama.rn) |
| onnxruntime-react-native | Run ONNX models | [GitHub](https://github.com/msfrisbie/onnxruntime-react-native) |
| expo-sqlite | Local database | [Expo Docs](https://docs.expo.dev/versions/latest/sdk/sqlite/) |
| expo-document-picker | File import | [Expo Docs](https://docs.expo.dev/versions/latest/sdk/document-picker/) |

### Learning Resources

- [llama.cpp documentation](https://github.com/ggerganov/llama.cpp) — Understanding GGUF format
- [Expo Prebuild docs](https://docs.expo.dev/workflow/prebuild/) — Native module setup
- [React Native JSI](https://reactnative.dev/docs/the-new-architecture/what-is-the-new-architecture) — How native bridging works

---

## Checklist Summary

### Phase 1 Checklist
- [ ] Android Studio + SDK installed
- [ ] `npx expo prebuild` completed
- [ ] llama.rn added to project
- [ ] Model file downloaded and placed in assets
- [ ] metro.config.js updated for .gguf files
- [ ] LLMService created and tested
- [ ] DatabaseService created
- [ ] Loading splash screen implemented
- [ ] Chat UI components built
- [ ] useLLMChat hook implemented
- [ ] Full chat flow working
- [ ] Streaming responses working
- [ ] Conversation history working
- [ ] Tested on real device

### Phase 2 Checklist
- [ ] onnxruntime-react-native added
- [ ] Embedding model downloaded
- [ ] EmbeddingService created
- [ ] Document picker integrated
- [ ] Document parser working
- [ ] Chunking logic implemented
- [ ] Database schema updated
- [ ] Import pipeline working
- [ ] Vector search working
- [ ] RAG prompt builder working
- [ ] RAG integrated into chat
- [ ] Source references displayed
- [ ] Full RAG flow tested

---

*Document created: February 2026*
*Last updated: February 2026*
*Project: AI Hackathon Mobile App*

---

## 12. Phase 1 Implementation Guide (Runanywhere SDK)

> **Step-by-step instructions for building the minimal chat app with Runanywhere SDK**

### Implementation Summary

| Component | Files | Priority | Est. Time |
|-----------|-------|----------|-----------|
| Dependencies & Config | 4 files | Critical | 30 min |
| Type Definitions | 2 files | High | 15 min |
| Database Layer | 2 files | Critical | 1.5 hours |
| LLM Services | 5 files | Critical | 2.5 hours |
| React Hooks | 2 files | Critical | 2 hours |
| UI Components | 5 files | High | 3 hours |
| Main Integration | 2 files | Critical | 2 hours |

**Total: ~12-14 hours of focused development**

---

### Quick Start Commands

```bash
# 1. Install dependencies
npm install @runanywhere/core @runanywhere/llamacpp expo-sqlite

# 2. Create folder structure
mkdir -p types services/{database,llm} hooks contexts components/{chat,ui}

# 3. Copy model file
mkdir -p assets/models
# Copy your qwen2.5-0.5b-instruct-q4_0.gguf to assets/models/

# 4. Run local build (after implementation)
npx expo run:android
```

---

### Testing Checklist

After implementation, verify:

✅ **Basic Functionality**
- [ ] App starts and shows loading screen
- [ ] Model loads within 15-20 seconds
- [ ] Can send a message and receive response
- [ ] Responses stream token-by-token
- [ ] Messages persist after app restart

✅ **Performance**
- [ ] Model loads without crashing
- [ ] Generation speed: 3-8 tokens/second
- [ ] No memory leaks during long chats
- [ ] App remains responsive during generation

✅ **Error Handling**
- [ ] Graceful error if model fails to load
- [ ] Can retry failed generation
- [ ] Empty message validation
- [ ] Network not required (offline mode)

---

### Next Steps After Phase 1

Once the minimal chat app is tested on a real device:

1. **Optimize Performance**
   - Profile memory usage
   - Tune generation parameters
   - Implement context pruning

2. **Polish UI/UX**
   - Add message timestamps
   - Implement copy-to-clipboard
   - Add conversation management
   - Theme customization

3. **Prepare for Phase 2**
   - Research ONNX models for embeddings
   - Plan document import flow
   - Design RAG prompt strategy
   - Estimate storage requirements

---

