# 🏴‍☠️ eyeeyecaptain!

**eyeeyecaptain!** is an assistive technology app designed to help people with visual impairments navigate the world safely.  
At its core, it combines **computer vision** and **voice feedback** to detect nearby objects and estimate their distances — empowering users to better understand their surroundings.

---

## 🚀 Overview

For demo purposes, **eyeeyecaptain!** was launched as a **web app** running locally, but it was originally designed as a **mobile application** to provide real-time object and distance detection on the go.

Using **Google’s Gemini API** for computer vision and **ElevenLabs API** for speech synthesis, the app provides **auditory feedback** in the voice of *Jack the Pirate* — bringing accessibility to life in a fun and engaging way.

---

## 🧠 Features

- **🔍 Object Detection:** Identifies objects in the user’s environment using Gemini’s computer vision capabilities.  
- **📏 Distance Detection:** Estimates how far each object is from the user to enhance spatial awareness.  
- **🗣️ Voice Feedback:** Announces detected objects and distances through Jack the Pirate’s voice using ElevenLabs API.  
- **💻 Web Demo:** Fully functional prototype running locally for demonstration and testing.  

---

## 🧩 Tech Stack

| Category | Technologies |
|-----------|--------------|
| **Frontend** | React Native (Expo), JavaScript |
| **Backend** | Python (Flask) |
| **APIs** | Gemini API (Computer Vision), ElevenLabs API (Voice Output) |
| **Platform** | Originally built for Mobile, Demo hosted on Localhost |
| **Voice Model** | Jack the Pirate (via ElevenLabs) |

---

## ⚙️ How It Works

1. **Camera Feed:** The app accesses the device camera to capture live video input.  
2. **Object Detection:** The Gemini API processes each frame to detect and classify objects.  
3. **Distance Estimation:** The app calculates approximate distances between the user and detected objects.  
4. **Audio Feedback:** Detected objects and their distances are read aloud using ElevenLabs’ Jack the Pirate voice.  

---

## 🧪 How to Use (Local Demo)

> ⚠️ Before running, ensure you have both **Python** and **Node.js (with Expo CLI)** installed.

### **1️⃣ Run the Backend**
1. Open your terminal and navigate to the directory that contains `app.py`  
   ```bash
   cd src
   python app.py

### **1️⃣ Run the Frontend**
2. Open your terminal and navigate to the directory that contains `index.jsx`  
   ```bash
   cd hackthevalley
   npx expo start 
