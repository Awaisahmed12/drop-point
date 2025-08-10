import React from 'react';
import Head from 'next/head';
import { ListView } from '../components/ListView';
import { MobileBottomNav } from '../components/MobileBottomNav';

export default function ListPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <Head>
        <title>Properties - DropPoint</title>
      </Head>
      {/* Render ListView as full-page content */}
      <div className="pt-4 pb-20">
        <ListView isOpen={true} onPropertySelect={() => { /* handled within ListView via onClose */ }} onClose={() => { /* noop on page */ }} />
      </div>
      <MobileBottomNav />
    </div>
  );
}


