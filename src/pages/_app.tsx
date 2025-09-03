import "@/styles/globals.css";
import type { AppProps } from "next/app";
import Head from "next/head";
import { useEffect } from "react";
import Router from "next/router";
import { CookieConsentBanner } from "../components/CookieConsentBanner";
import { ConfigProvider } from "../contexts/ConfigContext";

export default function App({ Component, pageProps }: AppProps) {
  useEffect(() => {
    let progress: HTMLDivElement | null = null;
    const ensureBar = () => {
      if (!progress) {
        progress = document.createElement('div');
        progress.id = 'route-progress-bar';
        progress.style.position = 'fixed';
        progress.style.top = '0';
        progress.style.left = '0';
        progress.style.height = '2px';
        progress.style.width = '0%';
        progress.style.background = '#2563eb';
        progress.style.zIndex = '99999';
        progress.style.transition = 'width 200ms ease';
        document.body.appendChild(progress);
      }
    };
    const start = () => {
      ensureBar();
      if (progress) {
        progress.style.opacity = '1';
        progress.style.width = '30%';
      }
    };
    const progressTick = () => {
      if (progress) {
        const current = parseFloat(progress.style.width);
        const next = Math.min(90, current + 10);
        progress.style.width = `${next}%`;
      }
    };
    const complete = () => {
      if (progress) {
        progress.style.width = '100%';
        setTimeout(() => {
          if (progress) {
            progress.style.opacity = '0';
            progress.style.width = '0%';
          }
        }, 200);
      }
    };
    let interval: number | null = null;
    const handleStart = () => {
      start();
      if (interval) window.clearInterval(interval);
      interval = window.setInterval(progressTick, 300);
    };
    const handleDone = () => {
      if (interval) window.clearInterval(interval);
      complete();
    };
    Router.events.on('routeChangeStart', handleStart);
    Router.events.on('routeChangeComplete', handleDone);
    Router.events.on('routeChangeError', handleDone);
    return () => {
      Router.events.off('routeChangeStart', handleStart);
      Router.events.off('routeChangeComplete', handleDone);
      Router.events.off('routeChangeError', handleDone);
      if (interval) window.clearInterval(interval);
      const el = document.getElementById('route-progress-bar');
      if (el && el.parentElement) el.parentElement.removeChild(el);
    };
  }, []);

  return (
    <ConfigProvider>
      <Head>
        {/* Mobile viewport optimization */}
        <meta 
          name="viewport" 
          content="width=device-width, initial-scale=1, shrink-to-fit=no, user-scalable=no, viewport-fit=cover" 
        />
      </Head>
      <Component {...pageProps} />
      <CookieConsentBanner />
    </ConfigProvider>
  );
}
