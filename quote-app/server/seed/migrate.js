// In-place migration for a live database: applies the rule patches WITHOUT wiping
// quotes/customers/prices. Safe to run repeatedly (idempotent).
import { openDb, createSchema } from '../db.js';
import { applyRulePatches } from './rulepatches.js';

const db = openDb();
createSchema(db);
const res = db.transaction(() => applyRulePatches(db))();
console.log(`Migration applied: ${res.removed} rules replaced/removed, ${res.added} rules added.`);
