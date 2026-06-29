import React from 'react';
import { Github, Instagram, Linkedin, } from 'lucide-react';

export const Footer = React.memo(function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="app-footer">
      <div className="footer-content">
        <div className="footer-brand">
          <p className="eyebrow">Project DiSini!</p>
          <p className="footer-credit">
            Dibuat dengan oleh <strong>Zidan Sulthan S</strong>
          </p>
        </div>

        <div className="footer-links">
          <a 
            href="/" 
            target="_blank" 
            rel="noopener noreferrer" 
            aria-label="GitHub"
            className="social-link"
          >
            <Github size={18} />
          </a>
          <a 
            href="https://www.instagram.com/zidnsultn?igsh=ZjV1aW5rcXE4YXEz&utm_source=qr" 
            target="_blank" 
            rel="noopener noreferrer" 
            aria-label="Instagram"
            className="social-link"
          >
            <Instagram size={18} />
          </a>
          <a 
            href="//" 
            target="_blank" 
            rel="noopener noreferrer" 
            aria-label="LinkedIn"
            className="social-link"
          >
            <Linkedin size={18} />
          </a>
        </div>
      </div>
      
      <div className="footer-bottom">
        <p>&copy; {currentYear} DiSini! Surabaya — Navigasi Kebutuhan Perantau.</p>
      </div>
    </footer>
  );
});
