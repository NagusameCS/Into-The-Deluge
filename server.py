#!/usr/bin/env python3
"""
Simple HTTP server for Into The Deluge
Run this script and open http://localhost:8000 in your browser
"""

import http.server
import socketserver
import webbrowser
import os

PORT = 8000

# Change to the script's directory
os.chdir(os.path.dirname(os.path.abspath(__file__)))

Handler = http.server.SimpleHTTPRequestHandler

# Add MIME type for JavaScript modules
Handler.extensions_map['.js'] = 'application/javascript'

print(f"Starting server at http://localhost:{PORT}")
print("Press Ctrl+C to stop the server")

# Open browser automatically
webbrowser.open(f'http://localhost:{PORT}')

with socketserver.TCPServer(("", PORT), Handler) as httpd:
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nServer stopped.")
