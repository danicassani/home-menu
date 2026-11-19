import { createClient } from 'npm:@supabase/supabase-js@2.119.0';
import { createPublicationHandler } from './handler.ts';
Deno.serve(createPublicationHandler(createClient,{url:Deno.env.get('SUPABASE_URL')!,anon:Deno.env.get('SUPABASE_ANON_KEY')!,key:Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!}));
