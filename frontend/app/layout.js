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
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
        <link rel="icon" href="/favicon.png" type="image/png" />
      </head>
      <body>{children}</body>
    </html>
  );
}
