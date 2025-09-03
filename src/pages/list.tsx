import React, { useCallback, useState } from 'react';
import Head from 'next/head';
import { ListView } from '../components/ListView';
import { MobileBottomNav } from '../components/MobileBottomNav';
import { PropertyDetailsModal } from '../components/PropertyDetailsModal';
import type { Property, PropertyFile, PropertyFolder } from '../../types';
import { supabase } from '../utils/supabaseClient';
import { withAuth } from '../components/withAuth';

function ListPage() {
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [savedProperty, setSavedProperty] = useState<Property | null>(null);
  const [snappedLatLng, setSnappedLatLng] = useState<{ lat: number; lng: number } | null>(null);
  const [folders, setFolders] = useState<PropertyFolder[]>([]);
  const [files, setFiles] = useState<PropertyFile[]>([]);
  const [foldersLoading, setFoldersLoading] = useState(false);
  const [filesLoading, setFilesLoading] = useState(false);
  const [selectedFolder, setSelectedFolder] = useState<string>('master');
  const pendingUploads: never[] = [];

  const openProperty = useCallback(async (p: { id: string | null; address: string; lat: number; lng: number; label?: string | null; notes?: string | null; }) => {
    // Map list item to Property type
    const prop: Property = {
      id: p.id,
      address: p.address,
      lat: p.lat,
      lng: p.lng,
      label: p.label ?? null,
      notes: p.notes ?? null,
    };
    setSavedProperty(prop);
    setSnappedLatLng({ lat: p.lat, lng: p.lng });
    setSelectedFolder('master');
    setShowDetailsModal(true);

    // Load property data
    setFoldersLoading(true);
    setFilesLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user && prop.id) {
        const [folderResult, filesResult] = await Promise.all([
          supabase
            .from('property_folders')
            .select('*')
            .eq('property_id', prop.id)
            .eq('user_id', user.id)
            .is('deleted_at', null)
            .order('created_at', { ascending: true }),
          supabase
            .from('property_files')
            .select('*')
            .eq('property_id', prop.id)
            .order('uploaded_at', { ascending: false })
        ]);
        if (folderResult.data) setFolders(folderResult.data);
        if (filesResult.data) setFiles(filesResult.data);
      } else {
        setFolders([]);
        setFiles([]);
      }
    } catch (e) {
      console.error('Error loading property data:', e);
    } finally {
      setFoldersLoading(false);
      setFilesLoading(false);
    }
  }, []);

  return (
    <div className="min-h-screen bg-gray-50">
      <Head>
        <title>Properties - DropPoint</title>
      </Head>
      {/* Render ListView as full-page content */}
      <div className="pt-4 pb-20">
        <ListView 
          isOpen={true} 
          variant="page"
          onPropertySelect={(property) => openProperty(property)} 
          onClose={() => { /* noop on page */ }} 
        />
      </div>
      <PropertyDetailsModal
        isOpen={showDetailsModal}
        property={savedProperty}
        snappedLatLng={snappedLatLng}
        onClose={() => setShowDetailsModal(false)}
        folders={folders}
        files={files}
        foldersLoading={foldersLoading}
        filesLoading={filesLoading}
        selectedFolder={selectedFolder}
        onFolderChange={setSelectedFolder}
        onFileUpload={async () => { /* optional: implement uploads on list later */ }}
        onFileDelete={() => { /* optional */ }}
        onFileRename={() => { /* optional */ }}
        onFolderCreate={() => { /* optional */ }}
        onFolderDelete={() => { /* optional */ }}
        pendingUploads={pendingUploads}
        onDismiss={() => { /* optional */ }}
        onPropertySwitch={(propertyWithCount, newFiles, newFolders) => {
          // Update property and its data inline, no map logic
          const switched: Property = {
            id: propertyWithCount.id,
            address: propertyWithCount.address,
            lat: propertyWithCount.lat,
            lng: propertyWithCount.lng,
            label: propertyWithCount.label ?? null,
            notes: propertyWithCount.notes ?? null,
          };
          setSavedProperty(switched);
          setSnappedLatLng({ lat: switched.lat, lng: switched.lng });
          setFiles(newFiles);
          setFolders(newFolders);
          setSelectedFolder('master');
        }}
      />
      <MobileBottomNav />
    </div>
  );
}

// Wrap with auth protection - require authentication
export default withAuth(ListPage, { requireAuth: true });


