import { Html, Head, Main, NextScript } from "next/document";

export default function Document() {
  return (
    <Html lang="en">
      <Head>
        {/* Mobile viewport optimization */}
        <meta 
          name="viewport" 
          content="width=device-width, initial-scale=1, shrink-to-fit=no, user-scalable=no, viewport-fit=cover" 
        />
        
        {/* iOS-specific optimizations */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-touch-fullscreen" content="yes" />
        
        {/* Prevent automatic telephone number detection */}
        <meta name="format-detection" content="telephone=no" />
        
        {/* Theme color for mobile browsers */}
        <meta name="theme-color" content="#ffffff" />
        <meta name="msapplication-navbutton-color" content="#ffffff" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
      </Head>
      <body className="antialiased">
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
