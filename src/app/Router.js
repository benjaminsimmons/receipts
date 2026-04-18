import React from 'react';
import { HashRouter } from 'react-router-dom';

/**
 * Router alias — swap the exported router here to change routing strategy
 * (e.g., switch to BrowserRouter for hosts that support SPA rewrites).
 * Currently using HashRouter for GitHub Pages compatibility.
 */
export default function Router({ children }) {
  return <HashRouter>{children}</HashRouter>;
}
