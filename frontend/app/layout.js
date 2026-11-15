import '@fontsource/roboto/latin-300.css';
import '@fontsource/roboto/latin-400.css';
import '@fontsource/roboto/latin-500.css';
import '@fontsource/roboto/latin-700.css';
import '@fontsource/roboto/latin-900.css';
import './globals.css';

export const metadata = {
  title: 'Vishwaship.com — Doorstep Courier & Cargo Across India',
  description: 'Ship anywhere in India. Check the final rate, book, get your AWB instantly and track every parcel from one dashboard.',
};
export const viewport = { width: 'device-width', initialScale: 1, themeColor: '#13214a' };

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" href="/favicon.png" type="image/png" />
      </head>
      <body>{children}</body>
    </html>
  );
}
