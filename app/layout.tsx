import { AppProvider } from '@/app/context/AppContext'
import './globals.css'

export const metadata = {
  title: 'Zero Zero',
  description: 'Zero Zero app',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" style={{ backgroundColor: '#FDFDFF' }}>
      <body style={{ backgroundColor: '#FDFDFF', minHeight: '100vh' }}>
        <AppProvider>{children}</AppProvider>
      </body>
    </html>
  )
}
