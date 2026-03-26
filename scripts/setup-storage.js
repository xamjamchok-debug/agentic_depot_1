import 'dotenv/config';
import { initStorage } from '../src/storage/client.js';

console.log('Azure Table Storage einrichten...');
await initStorage();
console.log('Fertig. Alle Tabellen sind bereit.');
