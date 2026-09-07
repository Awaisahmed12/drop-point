import { logger } from '../utils/logger';
import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { useAdminConfig } from '../contexts/ConfigContext';
import { withAuth } from '../components/withAuth';
import { MobileBottomNav } from '../components/MobileBottomNav';
import { useMobileViewport } from '../hooks/useMobileViewport';
import { TOAST_SUCCESS_MS, TOAST_ERROR_MS } from '../../constants';

interface ConfigItem {
  key: string;
  label: string;
  description: string;
  type: 'boolean' | 'string' | 'number';
  category: string;
  currentValue: unknown;
}

function AdminConfigPage() {
  const router = useRouter();
  const { getMobileStyles, mobileClasses } = useMobileViewport();
  const { 
    configurations, 
    loading, 
    error, 
    updateConfiguration, 
    isAdmin, 
    adminLoading,
    refreshConfigurations 
  } = useAdminConfig();
  
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [saveError, setSaveError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Configuration items definition
  const configItems: ConfigItem[] = [
    {
      key: 'street_view_enabled',
      label: 'Street View',
      description: 'Enable or disable Street View in property details modal. When disabled, Street View iframe and related UI elements will be hidden.',
      type: 'boolean',
      category: 'UI Features',
      currentValue: configurations.street_view_enabled
    },
    {
      key: 'property_image_enabled',
      label: 'Property Images',
      description: 'Enable or disable all property images (Street View and satellite) in property details modal. When disabled, no images will be shown.',
      type: 'boolean',
      category: 'UI Features',
      currentValue: configurations.property_image_enabled
    }
  ];

  // Redirect if not admin
  useEffect(() => {
    if (!adminLoading && !isAdmin) {
      router.replace('/map');
    }
  }, [isAdmin, adminLoading, router]);

  const handleConfigUpdate = async (key: string, value: unknown) => {
    setSaving(prev => ({ ...prev, [key]: true }));
    setSaveError(null);
    setSuccessMessage(null);

    try {
      await updateConfiguration(key, value);
      setSuccessMessage(`Configuration "${key}" updated successfully!`);
      setTimeout(() => setSuccessMessage(null), TOAST_SUCCESS_MS);
    } catch (err) {
      logger.error('Error updating configuration:', err);
      setSaveError(err instanceof Error ? err.message : 'Failed to update configuration');
      setTimeout(() => setSaveError(null), TOAST_ERROR_MS);
    } finally {
      setSaving(prev => ({ ...prev, [key]: false }));
    }
  };

  const renderConfigItem = (item: ConfigItem) => {
    const isSaving = saving[item.key];

    switch (item.type) {
      case 'boolean':
        return (
          <div key={item.key} className="bg-surface rounded-xl border border-hairline p-6 shadow-sm">
            <div className="flex items-start justify-between">
              <div className="flex-1 mr-4">
                <h3 className="text-lg font-semibold text-ink mb-2">{item.label}</h3>
                <p className="text-sm text-ink-2 mb-4">{item.description}</p>
                <div className="text-xs text-ink-2">
                  Category: <span className="font-medium">{item.category}</span>
                </div>
              </div>
              <div className="flex items-center">
                <button
                  onClick={() => handleConfigUpdate(item.key, !item.currentValue)}
                  disabled={isSaving}
                  className={`
                    relative inline-flex h-6 w-11 items-center rounded-full transition-colors
                    ${item.currentValue 
                      ? 'bg-accent' 
                      : 'bg-surface-2'
                    }
                    ${isSaving ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                  `}
                >
                  <span
                    className={`
                      inline-block h-4 w-4 transform rounded-full bg-surface transition-transform
                      ${item.currentValue ? 'translate-x-6' : 'translate-x-1'}
                    `}
                  />
                </button>
                {isSaving && (
                  <div className="ml-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-accent"></div>
                  </div>
                )}
              </div>
            </div>
            <div className="mt-3 text-sm">
              <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                item.currentValue 
                  ? 'bg-success/15 text-success' 
                  : 'bg-surface-2 text-ink'
              }`}>
                {item.currentValue ? 'Enabled' : 'Disabled'}
              </span>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  if (adminLoading || loading) {
    return (
      <div className="min-h-dvh bg-ground flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent mx-auto mb-4"></div>
          <p className="text-ink-2">Loading admin panel...</p>
        </div>
      </div>
    );
  }

  // Redirect non-admin users immediately (no UI shown)
  if (!isAdmin) {
    return null; // This will show nothing while redirect happens
  }

  return (
    <>
      <Head>
        <title>Admin Configuration - DropPoint</title>
        <meta name="description" content="Manage application configurations and settings" />
      </Head>
      
      <div className={`min-h-dvh bg-ground ${mobileClasses.fullScreen}`} style={getMobileStyles('page')}>
        <div className="max-w-4xl mx-auto px-4 py-6">
          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h1 className="text-3xl font-bold text-ink">Admin Configuration</h1>
                <p className="text-ink-2 mt-2">Manage application settings and feature toggles</p>
              </div>
              <button
                onClick={refreshConfigurations}
                className="bg-accent text-white px-4 py-2 rounded-lg hover:bg-accent/90 transition-colors flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Refresh
              </button>
            </div>

            {/* Status Messages */}
            {error && (
              <div className="bg-danger/10 border border-danger/30 rounded-lg p-4 mb-4">
                <div className="flex">
                  <svg className="w-5 h-5 text-danger" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-danger">Error</h3>
                    <p className="text-sm text-danger mt-1">{error}</p>
                  </div>
                </div>
              </div>
            )}

            {saveError && (
              <div className="bg-danger/10 border border-danger/30 rounded-lg p-4 mb-4">
                <div className="flex">
                  <svg className="w-5 h-5 text-danger" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-danger">Save Error</h3>
                    <p className="text-sm text-danger mt-1">{saveError}</p>
                  </div>
                </div>
              </div>
            )}

            {successMessage && (
              <div className="bg-success/10 border border-success/30 rounded-lg p-4 mb-4">
                <div className="flex">
                  <svg className="w-5 h-5 text-success" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-success">Success</h3>
                    <p className="text-sm text-success mt-1">{successMessage}</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Configuration Items */}
          <div className="space-y-6">
            {configItems.map(renderConfigItem)}
          </div>

          {/* Footer Info */}
          <div className="mt-12 bg-accent-soft border border-accent/40 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-accent mb-2">About Admin Configuration</h3>
            <p className="text-accent text-sm">
              Configuration changes take effect immediately across the application. 
              These settings control core functionality and should be changed carefully.
            </p>
          </div>
        </div>

        {/* Mobile Bottom Navigation */}
        <MobileBottomNav />
      </div>
    </>
  );
}

// Wrap with auth protection - require authentication
export default withAuth(AdminConfigPage, { requireAuth: true });
