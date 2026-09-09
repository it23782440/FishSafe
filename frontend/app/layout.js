import './globals.css';
import Navbar from '@/components/Navbar';

export const metadata = {
  title: 'FishSafe — Water Quality Monitoring',
  description:
    'Real-time water quality monitoring and alert dashboard for freshwater aquaculture.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <Navbar />
        <main className="max-w-7xl mx-auto px-4 py-6">{children}</main>
        <footer className="max-w-7xl mx-auto px-4 py-8 text-center text-xs text-slate-400">
          FishSafe · NTP/26/09 · Real-time freshwater aquaculture monitoring
        </footer>
      </body>
    </html>
  );
}
