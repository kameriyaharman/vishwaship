import './globals.css';

export const metadata = {
  title: 'Vishwaship — Courier booking for sellers & businesses',
  description: 'Ship anywhere in India. Check the final rate, book, get your AWB instantly and track every parcel from one dashboard.',
};
export const viewport = { width: 'device-width', initialScale: 1, themeColor: '#13214a' };

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap" rel="stylesheet" />
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
      </head>
      <body>{children}</body>
    </html>
  );
}
