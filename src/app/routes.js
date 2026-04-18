import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import UploadPage from '../features/upload/UploadPage';
import OcrQueuePage from '../features/ocr/OcrQueuePage';
import CategorizePage from '../features/categorize/CategorizePage';
import CategoriesPage from '../features/categories/CategoriesPage';
import ArchivePage from '../features/archive/ArchivePage';
import SettingsPage from '../features/settings/SettingsPage';

export default function RoutesRoot() {
  return (
    <Routes>
      <Route path="/upload" element={<UploadPage />} />
      <Route path="/ocr" element={<OcrQueuePage />} />
      <Route path="/categorize" element={<CategorizePage />} />
      <Route path="/categories" element={<CategoriesPage />} />
      <Route path="/archive" element={<ArchivePage />} />
      <Route path="/settings" element={<SettingsPage />} />
      <Route path="/" element={<Navigate to="/upload" replace />} />
    </Routes>
  );
}
