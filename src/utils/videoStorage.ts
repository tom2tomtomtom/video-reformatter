/**
 * Utility for persistent storage of videos using IndexedDB
 * This helps prevent blob URLs from becoming invalid between sessions
 */
import { v4 as uuidv4 } from 'uuid';

// Define the name and version of our IndexedDB database
const DB_NAME = 'VideoReformatterDB';
const DB_VERSION = 1;
const VIDEO_STORE = 'videos';

// Initialize the database connection
const openDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    
    request.onerror = (event) => {
      reject(`Database error: ${(event.target as IDBOpenDBRequest).error}`);
    };
    
    request.onsuccess = (event) => {
      resolve((event.target as IDBOpenDBRequest).result);
    };
    
    // Create object store if it doesn't exist
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(VIDEO_STORE)) {
        db.createObjectStore(VIDEO_STORE, { keyPath: 'id' });
      }
    };
  });
};

// Store a video file in IndexedDB
export const storeVideo = async (file: File): Promise<{ videoId: string, url: string }> => {
  console.log("storeVideo called with file:", file.name, file.type, file.size);
  
  try {
    // Create a URL for immediate use - do this first to ensure we have it
    const url = URL.createObjectURL(file);
    console.log("Created blob URL:", url);
    
    // Generate a unique ID
    const videoId = uuidv4();
    console.log("Generated video ID:", videoId);
    
    // Now try storing in IndexedDB
    try {
      const db = await openDB();
      console.log("IndexedDB opened successfully");
      
      return new Promise((resolve, reject) => {
        const transaction = db.transaction([VIDEO_STORE], 'readwrite');
        const store = transaction.objectStore(VIDEO_STORE);
        
        console.log("Storing video in IndexedDB...");
        
        // Store the file and metadata
        const request = store.put({
          id: videoId,
          file: file,
          fileName: file.name,
          type: file.type,
          timestamp: new Date().getTime()
        });
        
        request.onsuccess = () => {
          console.log("Video stored successfully in IndexedDB");
          resolve({ videoId, url });
        };
        
        request.onerror = (e) => {
          // If there's an error storing in IndexedDB, we still return the URL
          console.warn('Failed to store video in IndexedDB, but URL was created:', e);
          resolve({ videoId, url });
        };
        
        // Also monitor transaction for errors
        transaction.oncomplete = () => {
          console.log("IndexedDB transaction completed successfully");
        };
        
        transaction.onerror = (e) => {
          console.error("IndexedDB transaction error:", e);
          // Still resolve since we have the URL
          resolve({ videoId, url });
        };
      });
    } catch (dbError) {
      console.error('Error accessing IndexedDB:', dbError);
      // Return the URL even if DB access fails
      return { videoId, url };
    }
  } catch (error) {
    console.error('Fatal error in storeVideo:', error);
    throw new Error(`Failed to process video: ${error}`);
  }
};

// Retrieve a video file from IndexedDB
export const retrieveVideo = async (videoId: string): Promise<{ file: File, url: string } | null> => {
  try {
    const db = await openDB();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([VIDEO_STORE], 'readonly');
      const store = transaction.objectStore(VIDEO_STORE);
      const request = store.get(videoId);
      
      request.onsuccess = () => {
        const data = request.result;
        if (data) {
          const url = URL.createObjectURL(data.file);
          resolve({ file: data.file, url });
        } else {
          resolve(null);
        }
      };
      
      request.onerror = () => {
        reject(`Error retrieving video with ID ${videoId}`);
      };
    });
  } catch (error) {
    console.error('Error in retrieveVideo:', error);
    return null;
  }
};

// Clean up old videos (call this periodically to prevent storage bloat)
export const cleanupOldVideos = async (maxAgeInDays = 7): Promise<void> => {
  try {
    const db = await openDB();
    const transaction = db.transaction([VIDEO_STORE], 'readwrite');
    const store = transaction.objectStore(VIDEO_STORE);
    
    const cutoffTime = new Date().getTime() - (maxAgeInDays * 24 * 60 * 60 * 1000);
    
    const request = store.openCursor();
    
    request.onsuccess = (event) => {
      const cursor = (event.target as IDBRequest).result as IDBCursorWithValue;
      if (cursor) {
        if (cursor.value.timestamp < cutoffTime) {
          store.delete(cursor.value.id);
        }
        cursor.continue();
      }
    };
  } catch (error) {
    console.error('Error in cleanupOldVideos:', error);
  }
};

// Try to recover a video by its ID
export const recoverVideo = async (videoId: string): Promise<string | null> => {
  try {
    const result = await retrieveVideo(videoId);
    return result ? result.url : null;
  } catch (error) {
    console.error('Failed to recover video:', error);
    return null;
  }
};
