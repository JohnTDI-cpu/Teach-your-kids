# 🍎 Teach Your Kids

An educational, bilingual flashcard application designed for toddlers. Built with **React Native (Expo)** and powered by an **AI-driven asset generation pipeline**.

[![Bilingual: PL/EN](https://img.shields.io/badge/Language-Polish%20%2F%20English-blue)](#)
[![Tech: React Native](https://img.shields.io/badge/Tech-React%20Native%20%2F%20Expo-green)](#)
[![AI: Flux.2 & Piper](https://img.shields.io/badge/AI-Flux.2%20%2F%20Piper%20TTS-orange)](#)

---

## 🌟 Overview

**Teach Your Kids** is designed to provide a safe, interactive, and educational experience for the youngest users. It uses high-quality visual and auditory assets to help children learn colors, letters, numbers, and animal sounds in both **Polish** and **English**.

### Key Features
- 🌍 **Bilingual Learning**: Seamlessly switch between Polish and English.
- 🎨 **Rich Visuals**: AI-generated 3D-style illustrations optimized for children.
- 🔊 **Clear Audio**: High-quality Text-to-Speech (TTS) for every educational item.
- 🔒 **Kiosk Mode (Android)**: Native locking mechanism to ensure children stay within the app.
- 🦁 **Interactive Categories**:
  - **Colors**: Full-screen vibrant colors.
  - **Letters**: "A is for Apple" / "A jak Arbuz" with matching images.
  - **Numbers**: Large, colorful 3D digits (0-9).
  - **Animals**: Friendly illustrations with interactive sounds.

---

## 📂 Project Structure

The repository is divided into two main parts: the mobile application and the asset generation pipeline.

```text
.
├── app/                  # React Native / Expo Mobile Application
│   ├── android/          # Native Android modules (Kiosk Mode implementation)
│   ├── assets/           # Generated images and audio files
│   ├── App.tsx           # Main application logic
│   └── AssetMap.ts       # Central mapping for dynamic asset loading
│
└── asset-gen/            # Python Asset Generation Pipeline
    ├── content_data.py   # Source of truth: All words, translations, and prompts
    ├── generate_images.py # FLUX.2 based image generation script
    ├── generate_audio.py  # Piper (ONNX) based TTS generation script
    ├── export_json.py    # Syncs content data for app consumption
    └── tts_models/       # Local ONNX models for offline TTS generation
```

---

## 🚀 How It Works

### 1. Asset Generation Pipeline (`asset-gen/`)
Instead of manual asset creation, this project uses a specialized AI pipeline:
- **Visuals**: Uses the **FLUX.2-klein-4B** model to generate consistent, high-quality educational illustrations.
- **Audio**: Uses **Piper TTS** with high-quality Polish (`pl_PL-gosia-medium`) and English (`en_US-lessac-medium`) models.
- **Logic**: `content_data.py` contains all definitions. Running the generation scripts automatically populates the `app/assets` directory.

### 2. Mobile App (`app/`)
- **React Native + Expo**: Provides a smooth, cross-platform experience.
- **Native Kiosk Mode**: A custom Kotlin implementation in the Android folder allows the app to act as a "Device Owner" or use "Screen Pinning" to prevent the child from exiting the app or accessing device settings.

---

## 🛠️ Setup & Development

### Prerequisites
- **Mobile**: Node.js, Expo Go, Android Studio (for native features).
- **Asset Gen**: Python 3.10+, PyTorch (for image gen), Piper (for audio).

### Running the App
```bash
cd app
npm install
npx expo start
```

### Generating Assets
```bash
cd asset-gen
# Configure your local model paths in content_data.py
python generate_images.py
python generate_audio.py
```

---

## 📝 License
This project is for educational purposes. All AI-generated assets are subject to the licenses of their respective models (Flux.2, Piper).
