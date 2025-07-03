import { IndexedDB } from '../shared/indexed-db';

export class ImageProcessor {
  private indexedDB: IndexedDB;

  constructor() {
    this.indexedDB = new IndexedDB();
  }

  async processHtmlContent(htmlContent: string): Promise<string> {
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlContent, 'text/html');
    const images = doc.querySelectorAll('img');
    
    for (const img of Array.from(images)) {
      const src = img.getAttribute('src');
      if (src && src.startsWith('http')) { // Only process external URLs for now
        try {
          const response = await fetch(src);
          const blob = await response.blob();
          const imageId = `image-${crypto.randomUUID()}`;
          await this.indexedDB.saveImage(imageId, blob);
          
          // Replace original src with a custom protocol or identifier
          img.setAttribute('src', `indexeddb://${imageId}`);
        } catch (error) {
          console.error('Failed to process image:', src, error);
          // Optionally, remove the image or replace with a placeholder
          img.remove(); 
        }
      }
    }
    return doc.body.innerHTML;
  }

  async retrieveImage(imageId: string): Promise<string | undefined> {
    const blob = await this.indexedDB.getImage(imageId);
    if (blob) {
      return URL.createObjectURL(blob);
    }
    return undefined;
  }
}
