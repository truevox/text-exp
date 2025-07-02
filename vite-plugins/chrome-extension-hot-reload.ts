import { Plugin } from 'vite';
import { WebSocketServer, WebSocket } from 'ws';

/**
 * Chrome Extension Hot Reload Plugin for Vite
 * Provides development-time hot reload functionality for Chrome extensions
 */
export function chromeExtensionHotReload(): Plugin {
  let wsServer: WebSocketServer;
  
  return {
    name: 'chrome-extension-hot-reload',
    configureServer(server) {
      // Create WebSocket server for hot reload communication
      wsServer = new WebSocketServer({ port: 8080 });
      
      console.log('🔄 Chrome Extension Hot Reload WebSocket server started on port 8080');
      
      // Handle file changes
      server.ws.on('file-change', () => {
        if (wsServer) {
          wsServer.clients.forEach((client: WebSocket) => {
            if (client.readyState === client.OPEN) {
              client.send(JSON.stringify({ type: 'reload' }));
            }
          });
        }
      });
    },
    
    generateBundle() {
      // Inject hot reload script in development mode
      if (process.env.NODE_ENV === 'development') {
        const hotReloadScript = `
          // Chrome Extension Hot Reload Script
          (function() {
            const ws = new WebSocket('ws://localhost:8080');
            
            ws.onmessage = function(event) {
              const data = JSON.parse(event.data);
              if (data.type === 'reload') {
                console.log('🔄 Hot reloading extension...');
                chrome.runtime.reload();
              }
            };
            
            ws.onopen = function() {
              console.log('🔄 Hot reload connected');
            };
            
            ws.onclose = function() {
              console.log('🔄 Hot reload disconnected');
            };
          })();
        `;
        
        this.emitFile({
          type: 'asset',
          fileName: 'hot-reload.js',
          source: hotReloadScript
        });
      }
    },
    
    closeBundle() {
      if (wsServer) {
        wsServer.close();
      }
    }
  };
}