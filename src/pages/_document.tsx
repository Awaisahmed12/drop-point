import { Html, Head, Main, NextScript } from "next/document";

export default function Document() {
  return (
    <Html lang="en">
      <Head>
        <meta name="description" content="Map-based document management platform for real estate professionals. Select properties from an interactive map, organize unlimited files per property, and access everything from anywhere." />
        <meta name="keywords" content="real estate, document management, property files, map-based, file organization, real estate tools" />
        <meta name="author" content="DropPoint" />

        {/* Icons + installable app */}
        <link rel="icon" href="/logo.png" />
        <link rel="apple-touch-icon" href="/logo.png" />
        <link rel="manifest" href="/manifest.json" />

        {/* Open Graph */}
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://drop-point-xi.vercel.app/" />
        <meta property="og:title" content="DropPoint - Real Estate Document Management" />
        <meta property="og:description" content="Map-based document management platform for real estate professionals. Select properties from an interactive map, organize unlimited files per property, and access everything from anywhere." />
        <meta property="og:image" content="https://drop-point-xi.vercel.app/logo.png" />
        <meta property="og:image:width" content="505" />
        <meta property="og:image:height" content="482" />
        <meta property="og:image:alt" content="DropPoint Logo - Real Estate Document Management" />
        <meta property="og:site_name" content="DropPoint" />

        {/* Twitter */}
        <meta property="twitter:card" content="summary" />
        <meta property="twitter:url" content="https://drop-point-xi.vercel.app/" />
        <meta property="twitter:title" content="DropPoint - Real Estate Document Management" />
        <meta property="twitter:description" content="Map-based document management platform for real estate professionals. Select properties from an interactive map, organize unlimited files per property, and access everything from anywhere." />
        <meta property="twitter:image" content="https://drop-point-xi.vercel.app/logo.png" />
        <meta property="twitter:image:alt" content="DropPoint Logo - Real Estate Document Management" />

        <meta name="robots" content="index, follow" />

        {/* Home-screen app: full-bleed under the status bar; pages pad with safe-area insets. */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="DropPoint" />
        <meta name="application-name" content="DropPoint" />
        <meta name="format-detection" content="telephone=no" />
        <meta name="theme-color" media="(prefers-color-scheme: light)" content="#f2f2f7" />
        <meta name="theme-color" media="(prefers-color-scheme: dark)" content="#000000" />
      </Head>
      <body className="antialiased">
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
