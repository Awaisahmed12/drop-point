import { logger } from '../utils/logger';
import React, { useCallback, useState } from 'react';
import Head from 'next/head';
import { ListView } from '../components/ListView';
import { MobileBottomNav } from '../components/MobileBottomNav';
import { WebSidebar } from '../components/WebSidebar';
import { PropertyDetailsModal } from '../components/PropertyDetailsModal';
import type { Property, PropertyFile, PropertyFolder, PropertyWithFileCount } from '../../types';
import { withAuth } from '../components/withAuth';
import { useUserProperties } from '../hooks/useUserProperties';
import { usePropertyFileActions } from '../hooks/usePropertyFileActions';
import { getPropertyDataSync, setPropertyDataCache } from '../hooks/usePropertyPrefetch';
import { propertyService } from '../services';
import { useToast } from '../contexts/ToastContext';

const toProperty = (p: Property | PropertyWithFileCount): Property => ({
  id: p.id,
  address: p.address,
  lat: p.lat,
  lng: p.lng,
  label: p.label ?? null,
  notes: p.notes ?? null,
});

function ListPage() {
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [savedProperty, setSavedProperty] = useState<Property | null>(null);
  const [folders, setFolders] = useState<PropertyFolder[]>([]);
  const [files, setFiles] = useState<PropertyFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedFolder, setSelectedFolder] = useState<string>('master');
  const { showToast } = useToast();
  const { properties, loading: propertiesLoading, error: propertiesError, refreshProperties } = useUserProperties();

  const fileActions = usePropertyFileActions({
    property: savedProperty,
    files,
    setFiles,
    folders,
    setFolders,
    selectedFolder,
  });

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

  const renameProperty = useCallback(async (property: PropertyWithFileCount, label: string) => {
    if (!property.id) return;
    await propertyService.updateProperty(property.id, { label: label.trim() || null });
    await refreshProperties();
    showToast('Property renamed', 'success');
  }, [refreshProperties, showToast]);

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Head>
        <title>Properties - DropPoint</title>
      </Head>
      <WebSidebar
        properties={properties}
        selectedPropertyId={savedProperty?.id}
        onPropertySelect={openProperty}
      />
      <div className="flex-1 overflow-auto">
        <ListView
          properties={properties}
          loading={propertiesLoading}
          error={propertiesError}
          onPropertySelect={openProperty}
          onRenameProperty={renameProperty}
        />
      </div>
      <PropertyDetailsModal
        isOpen={showDetailsModal}
        property={savedProperty}
        snappedLatLng={savedProperty ? { lat: savedProperty.lat, lng: savedProperty.lng } : null}
        onClose={() => setShowDetailsModal(false)}
        folders={folders}
        files={files}
        foldersLoading={loading}
        filesLoading={loading}
        selectedFolder={selectedFolder}
        onFolderChange={setSelectedFolder}
        onFileUpload={fileActions.uploadFiles}
        onFileDelete={fileActions.deleteFile}
        onFileRename={fileActions.renameItem}
        onFileMove={fileActions.moveFile}
        onFileCopy={fileActions.copyFile}
        onFolderCreate={fileActions.createFolder}
        onFolderDelete={fileActions.deleteFolder}
        pendingUploads={fileActions.pendingUploads}
        onDismiss={fileActions.dismissPendingUpload}
        onPropertySwitch={(property, newFiles, newFolders) => {
          setSavedProperty(toProperty(property));
          setFiles(newFiles);
          setFolders(newFolders);
          setSelectedFolder('master');
        }}
      />
      <MobileBottomNav />
    </div>
  );
}

export default withAuth(ListPage, { requireAuth: true });
