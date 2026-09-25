import { logger } from '../utils/logger';
import React, { useCallback, useEffect, useState } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { ListView } from '../components/ListView';
import { MobileBottomNav } from '../components/MobileBottomNav';
import { WebSidebar } from '../components/WebSidebar';
import { PropertyDetailsModal } from '../components/PropertyDetailsModal';
import { ViewChips } from '../components/ViewChips';
import { ViewsSheet } from '../components/ViewsSheet';
import type { Property, PropertyFile, PropertyFolder, PropertyWithFileCount } from '../../types';
import { withAuth } from '../components/withAuth';
import { useUserProperties } from '../hooks/useUserProperties';
import { useUpcomingReminders } from '../hooks/useUpcomingReminders';
import { useSheetHistory } from '../hooks/useSheetHistory';
import { usePropertyFileActions } from '../hooks/usePropertyFileActions';
import { useTagViews } from '../hooks/useTagViews';
import { getPropertyDataSync, setPropertyDataCache, prefetchPropertyData, invalidatePropertyCache } from '../hooks/usePropertyPrefetch';
import { propertyService } from '../services';
import { useToast } from '../contexts/ToastContext';

const toProperty = (p: Property | PropertyWithFileCount): Property => ({
  id: p.id,
  user_id: p.user_id,
  address: p.address,
  lat: p.lat,
  lng: p.lng,
  label: p.label ?? null,
  notes: p.notes ?? null,
  tag_ids: p.tag_ids ?? [],
});

function ListPage() {
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [savedProperty, setSavedProperty] = useState<Property | null>(null);
  const [folders, setFolders] = useState<PropertyFolder[]>([]);
  const [files, setFiles] = useState<PropertyFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedFolder, setSelectedFolder] = useState<string>('master');
  const [viewsOpen, setViewsOpen] = useState(false);
  const { showToast } = useToast();
  const views = useTagViews();
  const { properties, loading: propertiesLoading, error: propertiesError, refreshProperties } = useUserProperties();
  const reminders = useUpcomingReminders();
  const router = useRouter();

  // On someone else's property, what you add is for the team by default.
  const collaborating = Boolean(savedProperty?.user_id && views.userId && savedProperty.user_id !== views.userId);
  const fileActions = usePropertyFileActions({
    property: savedProperty,
    files,
    setFiles,
    folders,
    setFolders,
    selectedFolder,
    defaultVisibility: collaborating ? 'shared' : 'private',
  });

  // Warm the most recent properties (files, hero photo, first thumbnails) so
  // the first tap opens a finished sheet instead of one that fills in.
  useEffect(() => {
    if (propertiesLoading || properties.length === 0) return;
    const timers = properties.slice(0, 8).map((p, i) =>
      setTimeout(() => { if (p.id) void prefetchPropertyData(p.id, p); }, 200 + i * 250),
    );
    return () => timers.forEach(clearTimeout);
  }, [properties, propertiesLoading]);

  const openProperty = useCallback(async (input: Property | PropertyWithFileCount) => {
    const property = toProperty(input);
    setSavedProperty(property);
    setSelectedFolder('master');
    setShowDetailsModal(true);

    if (!property.id) {
      setFolders([]);
      setFiles([]);
      return;
    }

    const cached = getPropertyDataSync(property.id);
    if (cached) {
      setFolders(cached.folders);
      setFiles(cached.files);
      return;
    }

    setLoading(true);
    try {
      const data = await propertyService.getPropertyData(property.id);
      setPropertyDataCache(property.id, data.files, data.folders);
      setFolders(data.folders);
      setFiles(data.files);
    } catch (error) {
      logger.error('Error loading property data:', error);
      showToast('Could not load this property’s files.');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  const openPropertyById = useCallback((id: string) => {
    const match = properties.find(p => p.id === id);
    if (!match) return false;
    void openProperty(match);
    return true;
  }, [properties, openProperty]);

  // Back/Forward move between properties and folders; a link opens a property.
  const sheetHistory = useSheetHistory({
    isOpen: showDetailsModal,
    propertyId: savedProperty?.id ?? null,
    selectedFolder,
    ready: !propertiesLoading,
    openPropertyById,
    closeSheet: () => setShowDetailsModal(false),
    setSelectedFolder,
  });

  const selectProperty = useCallback((property: Property | PropertyWithFileCount) => {
    void openProperty(property);
    if (property.id) sheetHistory.open(property.id);
  }, [openProperty, sheetHistory]);

  // From the Upcoming list: the URL opens the property, and the sheet opens the file.
  const openFile = useCallback((propertyId: string, fileId: string) => {
    void router.push(`${router.pathname}?property=${propertyId}&file=${fileId}`, undefined, { shallow: true });
  }, [router]);

  const renameProperty = useCallback(async (property: Property, label: string | null) => {
    if (!property.id) return;
    const updated = await propertyService.updateProperty(property.id, { label });
    setSavedProperty(toProperty(updated));
    await refreshProperties();
  }, [refreshProperties]);

  const deleteProperty = useCallback(async (property: Property) => {
    if (!property.id) return;
    await propertyService.deleteProperty(property.id);
    invalidatePropertyCache(property.id);
    sheetHistory.close();
    setSavedProperty(null);
    await refreshProperties();
    showToast('Property deleted', 'success');
  }, [sheetHistory, refreshProperties, showToast]);

  const changePropertyViews = useCallback(async (property: Property, tagIds: string[]) => {
    if (!property.id) return;
    const stored = await views.setPropertyViews(property.id, tagIds);
    setSavedProperty(prev => (prev && prev.id === property.id ? { ...prev, tag_ids: stored } : prev));
    await refreshProperties();
  }, [views, refreshProperties]);

  return (
    <div className="flex min-h-dvh bg-ground">
      <Head>
        <title>Properties - DropPoint</title>
      </Head>
      <WebSidebar
        properties={properties}
        selectedPropertyId={savedProperty?.id}
        onPropertySelect={selectProperty}
      />
      <div className="flex-1 overflow-auto">
        <ListView
          properties={properties}
          loading={propertiesLoading}
          error={propertiesError}
          onPropertySelect={selectProperty}
          toolbar={<ViewChips onManage={() => setViewsOpen(true)} className="sm:hidden -mx-3 mb-3" />}
          upcoming={reminders.files}
          onOpenFile={openFile}
        />
      </div>
      <ViewsSheet open={viewsOpen} onClose={() => setViewsOpen(false)} />
      <PropertyDetailsModal
        isOpen={showDetailsModal}
        property={savedProperty}
        snappedLatLng={savedProperty ? { lat: savedProperty.lat, lng: savedProperty.lng } : null}
        onClose={sheetHistory.close}
        folders={folders}
        files={files}
        foldersLoading={loading}
        filesLoading={loading}
        selectedFolder={selectedFolder}
        onFolderChange={sheetHistory.changeFolder}
        onFileUpload={fileActions.uploadFiles}
        onFileDelete={fileActions.deleteFile}
        onFileRename={fileActions.renameItem}
        onFileMove={fileActions.moveFile}
        onFolderCreate={fileActions.createFolder}
        onFolderDelete={fileActions.deleteFolder}
        pendingUploads={fileActions.pendingUploads}
        onDismiss={fileActions.dismissPendingUpload}
        onPropertyRename={renameProperty}
        onPropertyViewsChange={changePropertyViews}
        onPropertyDelete={deleteProperty}
        onFileVisibilityChange={fileActions.setFileVisibility}
        onFolderVisibilityChange={fileActions.setFolderVisibility}
        onFileReminderChange={async (file, remindAt) => {
          await fileActions.setFileReminder(file, remindAt);
          await reminders.refresh();
        }}
      />
      <MobileBottomNav />
    </div>
  );
}

export default withAuth(ListPage, { requireAuth: true });
