import '@fontsource/nunito/cyrillic-700.css'
import '@fontsource/nunito/cyrillic-800.css'
import '@fontsource/nunito/latin-700.css'
import '@fontsource/nunito/latin-800.css'
import '@fontsource/unbounded/cyrillic-700.css'
import '@fontsource/unbounded/latin-700.css'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Host } from './host.tsx'
import { Play } from './play.tsx'
import './ui.css'

const root = document.getElementById('root')
if (!root) throw new Error('root is missing')

createRoot(root).render(<StrictMode>{location.pathname === '/host' ? <Host /> : <Play />}</StrictMode>)
