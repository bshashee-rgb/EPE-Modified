import fs from 'fs';
import { openDb, createSchema, DB_PATH } from '../db.js';
import { seedFilters } from './filters.js';
import { seedAccumulators } from './accumulators.js';
import { seedSwitches } from './switches.js';
import { seedPricing } from './pricing.js';
import { applyRulePatches } from './rulepatches.js';

if (fs.existsSync(DB_PATH)) fs.rmSync(DB_PATH);
for (const ext of ['-wal', '-shm']) if (fs.existsSync(DB_PATH + ext)) fs.rmSync(DB_PATH + ext);

const db = openDb();
createSchema(db);

const insCat = db.prepare('INSERT INTO categories(code, name, sort) VALUES (?,?,?)');
insCat.run('FILTERS', 'Filters', 1);
insCat.run('ACCUMULATORS', 'Accumulators', 2);
insCat.run('SWITCHES', 'Pressure & Temperature Switches', 3);
insCat.run('VALVES', 'Valves', 4);
insCat.run('SYSTEMS', 'Filtration Systems', 5);

db.transaction(() => {
  seedFilters(db);
  seedAccumulators(db);
  seedSwitches(db);
  applyRulePatches(db);
  seedPricing(db);

  // demo customers
  const insCust = db.prepare('INSERT INTO customers(name, contact, email, phone, address, gstin) VALUES (?,?,?,?,?,?)');
  insCust.run('Bharat Heavy Electricals Ltd', 'Purchase Dept', 'purchase@example.com', '+91-40-00000000', 'Hyderabad, Telangana', '36AAACB0000A1Z0');
  insCust.run('L&T Hydraulics', 'Stores', 'stores@example.com', '+91-22-00000000', 'Powai, Mumbai', '27AAACL0000A1Z0');
  insCust.run('Demo Engineering Pvt Ltd', 'R. Kumar', 'rk@example.com', '+91-98-00000000', 'Chennai', '33AAACD0000A1Z0');
})();

const counts = {
  families: db.prepare('SELECT COUNT(*) n FROM families').get().n,
  segments: db.prepare('SELECT COUNT(*) n FROM segments').get().n,
  options: db.prepare('SELECT COUNT(*) n FROM options').get().n,
  rules: db.prepare('SELECT COUNT(*) n FROM rules').get().n,
  links: db.prepare('SELECT COUNT(*) n FROM companion_links').get().n,
  parts: db.prepare('SELECT COUNT(*) n FROM parts').get().n,
  basePrices: db.prepare('SELECT COUNT(*) n FROM base_prices').get().n,
  optionPrices: db.prepare('SELECT COUNT(*) n FROM option_prices').get().n,
};
console.log('Seed complete:', JSON.stringify(counts, null, 2));
