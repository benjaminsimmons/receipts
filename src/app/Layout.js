import React from 'react';
import { Container, Nav, Navbar, Button } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import { useMsal, useIsAuthenticated } from '@azure/msal-react';

function AccountControls() {
  const { instance, accounts } = useMsal();
  const isAuthenticated = useIsAuthenticated();

  const signIn = async () => {
    try {
      await instance.loginPopup();
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('login failed', e);
    }
  };

  const signOut = async () => {
    try {
      await instance.logoutPopup();
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('logout failed', e);
    }
  };

  return (
    <div>
      {isAuthenticated && accounts && accounts[0] ? (
        <>
          <span style={{ marginRight: 8 }}>{accounts[0].name || accounts[0].username}</span>
          <Button variant="outline-secondary" size="sm" onClick={signOut}>Sign out</Button>
        </>
      ) : (
        <Button variant="outline-primary" size="sm" onClick={signIn}>Sign in</Button>
      )}
    </div>
  );
}

export default function Layout({ children }) {
  return (
    <div>
      <Navbar bg="light" expand="lg">
        <Container>
          <Navbar.Brand>Receipts</Navbar.Brand>
          <Nav className="me-auto">
            <Nav.Link as={Link} to="/upload">Upload</Nav.Link>
            <Nav.Link as={Link} to="/ocr">OCR</Nav.Link>
            <Nav.Link as={Link} to="/categorize">Categorize</Nav.Link>
            <Nav.Link as={Link} to="/categories">Categories</Nav.Link>
            <Nav.Link as={Link} to="/archive">Archive</Nav.Link>
            <Nav.Link as={Link} to="/settings">Settings</Nav.Link>
          </Nav>
          <Navbar.Collapse className="justify-content-end">
            <AccountControls />
          </Navbar.Collapse>
        </Container>
      </Navbar>
      <Container className="app-container">{children}</Container>
    </div>
  );
}
