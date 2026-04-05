import { Routes, Route } from 'react-router-dom';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<h1>Welcome to Kribble Mobile</h1>} />
    </Routes>
  );
}
