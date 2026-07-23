import React from 'react'
import { BrowserRouter } from 'react-router-dom'
import { ContentProvider } from './utils/context/ContentContext'
import AppRouter from './routers/AppRouter'

export default function App() {
  return (
    <BrowserRouter>
      <ContentProvider>
        <AppRouter />
      </ContentProvider>
    </BrowserRouter>
  )
}
