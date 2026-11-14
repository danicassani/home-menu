// @vitest-environment node
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
it('aísla casas, restringe escrituras y valida invitaciones', async () => {
 const db=new PGlite();
 try {
 await db.exec(`create role anon; create role authenticated; create schema auth;
 create table auth.users(id uuid primary key);
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 grant usage on schema auth,public to authenticated,anon; grant execute on function auth.uid() to authenticated;
 insert into auth.users values ('00000000-0000-0000-0000-000000000001'),('00000000-0000-0000-0000-000000000002'),('00000000-0000-0000-0000-000000000003');`);
 await db.exec(readFileSync('supabase/migrations/202611140001_households.sql','utf8'));
 const user=async(n:number)=>db.exec(`reset role; set role authenticated; set request.jwt.claim.sub='00000000-0000-0000-0000-${String(n).padStart(12,'0')}';`);
 await user(1);
 await db.query(`select public.create_household('Casa A')`);
 await expect(db.query(`select public.create_household('Duplicada')`)).rejects.toThrow();
 const invite=await db.query<{token:string}>(`select public.create_household_invitation() as token`);
 const token=invite.rows[0].token;
 await user(2);
 expect((await db.query('select * from public.households')).rows).toHaveLength(0);
 await expect(db.query(`insert into public.households(name,owner_id) values('Intrusa',auth.uid())`)).rejects.toThrow();
 await expect(db.query('select public.create_household_invitation()')).rejects.toThrow();
 await db.query('select public.accept_household_invitation($1)',[token]);
 expect((await db.query('select * from public.households')).rows).toHaveLength(1);
 await expect(db.query('select public.accept_household_invitation($1)',[token])).rejects.toThrow();
 await expect(db.query('select public.create_household_invitation()')).rejects.toThrow();
 await user(1);
 const ids=await db.query<{id:string}>('select id from public.household_invitations');
 await db.query('select public.revoke_household_invitation($1)',[ids.rows[0].id]);
 await user(3);
 await expect(db.query('select public.accept_household_invitation($1)',[token])).rejects.toThrow();
 await db.exec("reset role; update public.household_invitations set revoked_at=null, expires_at=now()-interval '1 day';");
 await user(3);
 await expect(db.query('select public.accept_household_invitation($1)',[token])).rejects.toThrow('caducada');
 await db.query(`select public.create_household('Casa B')`);
 const houses=await db.query<{name:string}>('select name from public.households');
 expect(houses.rows).toEqual([{name:'Casa B'}]);
 expect((await db.query('select * from public.household_invitations')).rows).toHaveLength(0);
 }finally{await db.close();}
},30000);
