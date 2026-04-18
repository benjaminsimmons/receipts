import React from 'react';
import Router from './Router';
import Layout from './Layout';
import RoutesRoot from './routes';
import AuthProvider from '../auth/AuthProvider';

export default function App() {
  return (
    <Router>
      <AuthProvider>
        <Layout>
          <RoutesRoot />
        </Layout>
      </AuthProvider>
    </Router>
  );
}
