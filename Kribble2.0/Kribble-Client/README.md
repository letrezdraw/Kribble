# 🎨 Doodle

> **An online multiplayer drawing and guessing game (Pictionary) built with modern web technologies.**

The Doodle client serves as the front-end application for the Doodle game. It's built using **TypeScript**, **React**, and **Socket.IO** to deliver a smooth, interactive, and real-time drawing and guessing experience.

_The server-side code can be found at https://github.com/Experimentf/doodle-server_

### Sneak Peek
![ezgif-899f7b2c9f51ab](https://github.com/user-attachments/assets/b50ef856-9113-41e4-be95-b496d6f8674e)

---

## 🚀 Features

- 🎮 **Real-time Gameplay:** Players can draw and guess words in real-time using **Socket.IO**.
- ✍️ **Intuitive Drawing Tool:** A clean and responsive canvas for drawing.
- ⚡ **Live Updates:** Instant synchronization between users for smooth multiplayer gameplay.
- 🔐 **TypeScript Support:** Ensures reliable, scalable, and maintainable code.

---

## 🛠️ Tech Stack

A modern tech stack powers the Doodle client:

- **React**
- **TypeScript**
- **Socket.IO**
- **Tailwind**

---

## 🏗️ Project Structure

Here’s an overview of the folder structure within the client:

```
/src
│
├── components/    # React components (reusable UI elements like Canvas, Hunch, etc.)
│
├── routes/        # Route based components for home and game 
│
├── assets/        # Static assets (e.g., images, icons, etc.)
│
├── hooks/         # Custom React hooks
│
├── utils/         # Utility functions and helpers
│
├── constants/     # Constants like socket events, texts, etc.
│
├── workers/       # Various utility workers
│
├── contexts/      # React Context API for global state management
│
└── types/         # TypeScript type definitions
```

---

## 💻 Getting Started

### Prerequisites

Ensure you have the following installed:

- **Node.js (>= 16.x):** [Download here](https://nodejs.org/)

### Development Setup

1. Clone the repository:

   ```bash
   git clone https://github.com/Experimentf/doodle-client.git
   cd doodle-client
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Create a `.env` file in the root of the project and configure the following environment variables:

   ```env
   REACT_APP_DOODLE_SERVER_URL=http://localhost:5000
   ```

   The UI runs on :3000; Socket.IO must target Kribble-Server on :5000 (the CRA dev proxy is not used for sockets).

4. Start the development server:

   ```bash
   npm start
   ```

5. Open `http://localhost:3000` in your browser to access the client app.

---

## 📦 Deployment

To build the project for production:

```bash
npm run build
```

---

## 📡 Socket.IO Integration

The Doodle client heavily relies on **Socket.IO** for real-time communication with the server. Key features powered by Socket.IO include:

- Broadcasting live drawing data to other users.
- Sending and receiving chat messages.
- Synchronizing the game state (player turns, guesses, and scores).

---

## 🛡️ Environment Variables

| Variable                 | Description                     | Example                     |
|--------------------------|---------------------------------|-----------------------------|
| `REACT_APP_DOODLE_SERVER_URL` | Socket.IO server URL (Kribble-Server, default :5000) | `http://localhost:5000` |

---

## 🙌 Contributing

Contributions are welcome! If you’d like to improve the project, follow these steps:

1. Fork the repository.
2. Create your feature branch (`git checkout -b feature/awesome-feature`).
3. Commit your changes (`git commit -m 'Add awesome feature'`).
4. Push to the branch (`git push origin feature/awesome-feature`).
5. Open a pull request!

---

## 📝 License

This project is licensed under the **MIT License**. See the [LICENSE](https://github.com/Experimentf/doodle-client/blob/main/LICENSE) file for details.

---

## 📧 Contact

If you have any questions or suggestions, feel free to contact the project maintainers:

## 👨‍💻 Maintainers

<table>
  <tr>
    <td align="center">
      <a href="https://github.com/divyanshf">
        <img src="https://github.com/divyanshf.png" width="100px;" alt="divyanshf"/><br />
        <sub><b>@divyanshf</b></sub>
      </a>
    </td>
  </tr>
</table>


---

Enjoy building and playing **Doodle**! 🎉

---

Let me know if you need me to customize or expand this in any way! 😊
