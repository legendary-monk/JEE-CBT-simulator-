/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { openDB, IDBPDatabase } from 'idb';
import { Test, Attempt } from './types';

const DB_NAME = 'JEECBTPortalDB';
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase> | null = null;

function getDB() {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('tests')) {
          db.createObjectStore('tests', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('attempts')) {
          db.createObjectStore('attempts', { keyPath: 'id' });
        }
      },
    });
  }
  return dbPromise;
}

export async function saveTest(test: Test): Promise<void> {
  const db = await getDB();
  await db.put('tests', test);
}

export async function getAllTests(): Promise<Test[]> {
  const db = await getDB();
  return db.getAll('tests');
}

export async function getTestById(id: string): Promise<Test | undefined> {
  const db = await getDB();
  return db.get('tests', id);
}

export async function deleteTest(id: string): Promise<void> {
  const db = await getDB();
  const tx = db.transaction(['tests', 'attempts'], 'readwrite');
  await tx.objectStore('tests').delete(id);
  
  // Also delete attempts associated with this test
  const attemptsStore = tx.objectStore('attempts');
  const attempts = await attemptsStore.getAll();
  for (const attempt of attempts) {
    if (attempt.testId === id) {
      await attemptsStore.delete(attempt.id);
    }
  }
  await tx.done;
}

export async function saveAttempt(attempt: Attempt): Promise<void> {
  const db = await getDB();
  await db.put('attempts', attempt);
}

export async function getAttempt(id: string): Promise<Attempt | undefined> {
  const db = await getDB();
  return db.get('attempts', id);
}

export async function getAllAttempts(): Promise<Attempt[]> {
  const db = await getDB();
  const attempts = await db.getAll('attempts');
  // Sort attempts by start time descending (newest first)
  return attempts.sort((a, b) => b.startTime - a.startTime);
}

export async function deleteAttempt(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('attempts', id);
}

/**
 * Exports all DB content to a single JSON object
 */
export async function exportDatabaseState(): Promise<string> {
  const tests = await getAllTests();
  const attempts = await getAllAttempts();
  return JSON.stringify({ tests, attempts }, null, 2);
}

/**
 * Imports full DB content from a JSON string
 */
export async function importDatabaseState(jsonStr: string): Promise<{ success: boolean; error?: string }> {
  try {
    const data = JSON.parse(jsonStr);
    if (!data || typeof data !== 'object') {
      return { success: false, error: 'Invalid JSON format' };
    }

    const { tests, attempts } = data;
    if (!Array.isArray(tests) || !Array.isArray(attempts)) {
      return { success: false, error: 'Missing tests or attempts collections' };
    }

    const db = await getDB();
    const tx = db.transaction(['tests', 'attempts'], 'readwrite');

    // Import tests
    const testsStore = tx.objectStore('tests');
    for (const test of tests) {
      if (test.id && test.name && Array.isArray(test.questions)) {
        await testsStore.put(test);
      }
    }

    // Import attempts
    const attemptsStore = tx.objectStore('attempts');
    for (const attempt of attempts) {
      if (attempt.id && attempt.testId && attempt.responses) {
        await attemptsStore.put(attempt);
      }
    }

    await tx.done;
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to parse JSON backup' };
  }
}
