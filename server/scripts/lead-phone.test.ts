import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';

test('optional phone migration preserves records and rejects duplicate real numbers', async () => {
  const db = new PGlite();
  try {
    await db.exec(`CREATE TABLE leads(id serial primary key, company_id integer, phone text NOT NULL, UNIQUE(phone, company_id));
      INSERT INTO leads(company_id,phone) VALUES(1,'11999990000');`);
    const patch = readFileSync(new URL('../../database/patches/20261119-lead-phone-optional.sql', import.meta.url), 'utf8');
    await db.exec(patch);
    await db.exec(patch);
    await db.exec(`INSERT INTO leads(company_id,phone) VALUES(1,NULL),(1,NULL),(2,'11999990000');`);
    await assert.rejects(db.exec(`INSERT INTO leads(company_id,phone) VALUES(1,'11999990000');`), /unique constraint/);
    const result = await db.query<{count:number}>('SELECT count(*)::int AS count FROM leads');
    assert.equal(result.rows[0].count,4);
  } finally { await db.close(); }
});
