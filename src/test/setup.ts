// jsdom has no IndexedDB, so give Dexie a real in-memory implementation.
// Must come before anything that opens the database.
import 'fake-indexeddb/auto'
import '@testing-library/jest-dom/vitest'
