# Kribble

A modern, real-time multiplayer drawing and guessing game platform built as a multi-version monorepo. Kribble brings together a polished game experience, live canvas synchronization, room-based multiplayer flow, and a scalable architecture designed for future growth.

## ✨ What is Kribble?

Kribble is a Pictionary-style online game where players:

- join rooms and play with friends or strangers,
- take turns drawing while others guess,
- experience real-time multiplayer interactions,
- enjoy a growing platform that spans multiple generations of development.

This repository contains the evolution of Kribble across several major versions, with K3.0 representing the current structured and production-oriented direction.

## 🚀 Highlights

- Real-time multiplayer gameplay
- Live canvas drawing and sync
- Room-based game flow
- Cross-device desktop/mobile client support
- Modular architecture with shared game and drawing engines
- Docker-based local development setup
- TypeScript-first codebase

## 🧱 Project Structure

- K3.0 — current monorepo architecture with web apps, server, and shared packages
- Kribble1.0 — earlier implementation with core gameplay and canvas features
- Kribble2.0 — legacy multiplayer client/server version
- Kribble4.0 — newer platform iteration and architecture experiments

## 🛠 Tech Stack

- TypeScript
- React / Vite
- Node.js
- WebSockets for real-time play
- Prisma + PostgreSQL
- Redis
- Docker / Docker Compose

## ▶️ Quick Start

The recommended place to start is the K3.0 workspace.

```bash
cd K3.0
npm install
cp .env.example .env
```

Then follow the local setup guide in [K3.0/GETTING_STARTED.md](K3.0/GETTING_STARTED.md).

## 📚 Documentation

Useful docs are available in the repository:

- [K3.0/GETTING_STARTED.md](K3.0/GETTING_STARTED.md)
- [K3.0/K3-Database-And-Tech-Stack.md](K3.0/K3-Database-And-Tech-Stack.md)
- [K3.0/docs/KRIBBLE_FULL_SYSTEM_DOCUMENTATION.md](K3.0/docs/KRIBBLE_FULL_SYSTEM_DOCUMENTATION.md)

## 🧪 Development Workflow

From the K3.0 root directory, you can run:

```bash
npm run dev
```

This starts the server and client applications for development.

## 🌟 Why This Project Matters

Kribble is more than a game prototype — it is a full multiplayer platform concept that has evolved through several engineering iterations. The project demonstrates:

- scalable real-time architecture,
- clean separation of game logic and drawing systems,
- iterative product development across versions,
- practical experience with modern web and backend tooling.

## 🤝 Contributing

Contributions are welcome. If you would like to improve the game, documentation, architecture, or developer experience, feel free to open a pull request or start a discussion.

---

Built with passion for playful, interactive multiplayer experiences.
