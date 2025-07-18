import { Html, Head, Main, NextScript } from "next/document";

export default function Document() {
  return (
    <Html lang="en">
      <Head>
        {/* Basic metadata */}
        <title>DropPoint - Real Estate Document Management</title>
        <meta name="description" content="Map-based document management platform for real estate professionals. Select properties from an interactive map, organize unlimited files per property, and access everything from anywhere." />
        <meta name="keywords" content="real estate, document management, property files, map-based, file organization, real estate tools" />
        <meta name="author" content="DropPoint" />
        
        {/* Favicon */}
        <link rel="icon" href="/logo.png" />
        <link rel="apple-touch-icon" href="/logo.png" />
        
        {/* Open Graph / Facebook */}
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://drop-point-xi.vercel.app/" />
        <meta property="og:title" content="DropPoint - Real Estate Document Management" />
        <meta property="og:description" content="Map-based document management platform for real estate professionals. Select properties from an interactive map, organize unlimited files per property, and access everything from anywhere." />
        <meta property="og:image" content="https://drop-point-xi.vercel.app/logo.png" />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta property="og:image:alt" content="DropPoint Logo - Real Estate Document Management" />
        <meta property="og:site_name" content="DropPoint" />
        
        {/* Twitter */}
        <meta property="twitter:card" content="summary_large_image" />
        <meta property="twitter:url" content="https://drop-point-xi.vercel.app/" />
        <meta property="twitter:title" content="DropPoint - Real Estate Document Management" />
        <meta property="twitter:description" content="Map-based document management platform for real estate professionals. Select properties from an interactive map, organize unlimited files per property, and access everything from anywhere." />
        <meta property="twitter:image" content="https://drop-point-xi.vercel.app/logo.png" />
        <meta property="twitter:image:alt" content="DropPoint Logo - Real Estate Document Management" />
        
        {/* Additional metadata */}
        <meta name="robots" content="index, follow" />
        <meta name="language" content="English" />
        <meta name="category" content="Real Estate Technology" />
        
        {/* Mobile viewport optimization */}
        <meta 
          name="viewport" 
          content="width=device-width, initial-scale=1, shrink-to-fit=no, user-scalable=no, viewport-fit=cover" 
        />
        
        {/* iOS-specific optimizations */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-touch-fullscreen" content="yes" />
        <meta name="apple-mobile-web-app-title" content="DropPoint" />
        
        {/* Prevent automatic telephone number detection */}
        <meta name="format-detection" content="telephone=no" />
        
        {/* Theme color for mobile browsers */}
        <meta name="theme-color" content="#2563eb" />
        <meta name="msapplication-navbutton-color" content="#2563eb" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        
        {/* Additional PWA metadata */}
        <meta name="application-name" content="DropPoint" />
        <meta name="msapplication-TileColor" content="#2563eb" />
        <meta name="msapplication-TileImage" content="/logo.png" />
      </Head>
      <body className="antialiased">
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
