import { useState } from 'react';

/**
 * Hook for managing modal-related state
 * Handles modal visibility, address, and snapped coordinates
 */
export function useModalState() {
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [address, setAddress] = useState<string>('');
  const [addressLoading, setAddressLoading] = useState(false);
  const [snappedLatLng, setSnappedLatLng] = useState<{lat: number, lng: number} | null>(null);

  return {
    showDetailsModal,
    setShowDetailsModal,
    address,
    setAddress,
    addressLoading,
    setAddressLoading,
    snappedLatLng,
    setSnappedLatLng
  };
}

