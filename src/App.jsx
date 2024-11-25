import { useState } from 'react'
import reactLogo from './assets/react.svg'
import viteLogo from '/vite.svg'
import './App.css'
import AdminMenu from './components/AdminMenu';
import Duplicator from './components/Duplicator';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';


function App() {
  const [count, setCount] = useState(0)

  return (
    <>
    <Router>
      <Routes>
        <Route path="/" element={<Duplicator />} />
        <Route path="/AdminMenu" element={<AdminMenu />} />
      </Routes>
    </Router>
    </>
  )
}

export default App
