/**
 * Service layer exports
 * 
 * This module exports all service instances for dependency injection
 * Services abstract database/storage operations to enable:
 * - Testing (can mock services)
 * - Swapping implementations
 * - Reducing coupling between components and Supabase
 */

export { PropertyService, propertyService } from './PropertyService';
export { FileService, fileService } from './FileService';
export { FolderService, folderService } from './FolderService';

